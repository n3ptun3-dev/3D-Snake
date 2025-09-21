import { AuthResult, UserDTO, PiScopes, PaymentDTO } from '../types';
import { logger } from './logger';
import { PI_SANDBOX, BACKEND_URL, DUMMY_MODE } from '../config';

class PiService {
  private user: UserDTO | null = null;
  private accessToken: string | null = null;
  private linkedUser: UserDTO | null = null; // NEW: For linked sessions
  private onAuthUpdateCallbacks: ((user: UserDTO | null) => void)[] = [];
  private isPiBrowser = false;

  constructor() {
    // Restore linked user from session storage on page load
    try {
        const storedUser = sessionStorage.getItem('piLinkedUser');
        if (storedUser) {
            this.linkedUser = JSON.parse(storedUser);
            logger.log(`Restored linked user from session: ${this.linkedUser?.username}`);
        }
    } catch (e) {
        logger.log('Could not restore linked user from session storage.');
        sessionStorage.removeItem('piLinkedUser');
    }
  }

  public setIsPiBrowser(isPi: boolean) {
    this.isPiBrowser = isPi;
    logger.log(`PiService environment set: isPiBrowser=${isPi}`);
  }

  private setUser(auth: AuthResult | null) {
    this.user = auth ? auth.user : null;
    this.accessToken = auth ? auth.accessToken : null;
    // When authenticating via Pi, clear any old linked session
    if (this.user) {
        this.clearLinkedUser();
    }
    this.notifySubscribers();
    logger.log(`Authenticated user set to: ${this.user ? this.user.username : 'null'}`);
  }

  private setLinkedUser(user: UserDTO | null) {
      this.linkedUser = user;
      if (user) {
          try {
              sessionStorage.setItem('piLinkedUser', JSON.stringify(user));
          } catch (e) {
              logger.log('Failed to save linked user to session storage.');
          }
      } else {
          sessionStorage.removeItem('piLinkedUser');
      }
      this.notifySubscribers();
      logger.log(`Linked user set to: ${user ? user.username : 'null'}`);
  }
  
  private clearLinkedUser() {
      if (this.linkedUser) {
        this.linkedUser = null;
        sessionStorage.removeItem('piLinkedUser');
        logger.log('Cleared linked user session.');
      }
  }

  private notifySubscribers() {
      this.onAuthUpdateCallbacks.forEach(cb => cb(this.getCurrentUser()));
  }

  public subscribe(callback: (user: UserDTO | null) => void): () => void {
    this.onAuthUpdateCallbacks.push(callback);
    callback(this.getCurrentUser());
    return () => {
        this.onAuthUpdateCallbacks = this.onAuthUpdateCallbacks.filter(cb => cb !== callback);
    };
  }

  public getCurrentUser(): UserDTO | null {
    // Authenticated user (from Pi Browser) takes precedence over a linked user.
    return this.user || this.linkedUser;
  }

  public isLinked(): boolean {
      return !!this.linkedUser && !this.user;
  }
  
  public openUrl(url: string) {
    if (this.isPiBrowser && typeof window.Pi?.openUrlInSystemBrowser === 'function') {
        logger.log(`Opening URL in system browser: ${url}`);
        window.Pi.openUrlInSystemBrowser(url);
    } else {
        logger.log(`Opening URL in new tab: ${url}`);
        window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
  
  /**
   * NOTE: The Pi SDK script is now loaded and initialized directly by a script
   * in `index.html` to prevent race conditions. This function is no longer
   * responsible for loading the script.
   */
  public initSdk(): Promise<void> {
    if (typeof window.Pi === 'undefined' && !DUMMY_MODE) {
      // This is a fallback warning. The script in index.html should have loaded the SDK.
      logger.log("Warning: initSdk called, but Pi SDK not found. Detection may fail.");
    }
    return Promise.resolve();
  }

  public async authenticate(): Promise<UserDTO> {
    logger.log('authenticate() called.');
    
    if (DUMMY_MODE) {
        logger.log("Executing in DUMMY MODE.");
        const dummyUser: UserDTO = {
            uid: `dummy-uid-${Date.now()}`,
            username: 'TestPioneer',
        };
        const dummyAuthResult: AuthResult = {
            accessToken: 'dummy-access-token',
            user: dummyUser,
        };
        this.setUser(dummyAuthResult);
        logger.log('Simulating network delay...');
        return new Promise(resolve => setTimeout(() => {
            logger.log('Dummy authentication successful.');
            resolve(dummyUser)
        }, 500));
    }

    logger.log("Executing in LIVE MODE.");
    
    let incompletePaymentWasFound = false;

    try {
      if (typeof window.Pi?.authenticate !== 'function') {
        const errorMsg = "Pi SDK is not ready for authentication. Please ensure you are in the Pi Browser and the app has fully loaded.";
        logger.log(`ERROR: ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      logger.log("Pi.authenticate() is available. Calling it now...");
      const scopes: PiScopes = ['username', 'payments'];
      
      const onIncompletePaymentFound = (payment: PaymentDTO): Promise<void> => {
        incompletePaymentWasFound = true;
        logger.log(`Incomplete payment found: ${payment.identifier}. Sending to backend for completion.`);
        
        // Return the promise chain, but ensure it never rejects to avoid an unhandled rejection inside the SDK.
        return fetch(`${BACKEND_URL}/handleIncompletePayment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment }),
        })
        .then(async (response) => {
          if (!response.ok) {
            // Log the failure from our backend, but don't treat it as a critical failure for the flow.
            const errorText = await response.text().catch(() => 'Could not read error response.');
            logger.log(`ERROR: Backend failed to handle incomplete payment ${payment.identifier}. Status: ${response.status}. Body: ${errorText}`);
          } else {
            logger.log(`Backend successfully handled incomplete payment ${payment.identifier}.`);
          }
        })
        .catch(err => {
          // This is a network error.
          logger.log(`ERROR: Network error while handling incomplete payment ${payment.identifier}: ${(err as Error).message}`);
        });
      };

      const authResult: AuthResult = await window.Pi.authenticate(scopes, onIncompletePaymentFound);
      logger.log(`Pi.authenticate() succeeded for user: ${authResult.user.username}. Verifying with backend...`);

      const verificationResponse = await fetch(`${BACKEND_URL}/verifyAuth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            accessToken: authResult.accessToken,
          }),
      });

      if (!verificationResponse.ok) {
          logger.log(`Backend verification failed: ${verificationResponse.status}. Invalidating session.`);
          this.setUser(null);
          throw new Error('Could not verify Pi session with the server. Please try again.');
      }
      
      logger.log('Backend verification successful.');
      this.setUser(authResult);
      return authResult.user;
    } catch (error: any) {
      logger.log(`Pi authentication process FAILED. Error code: ${error?.code}, Message: ${error?.message || 'Unknown error'}`);
      
      this.setUser(null); // Always invalidate user on any auth failure.

      if (incompletePaymentWasFound) {
          logger.log('Authentication failed because an incomplete payment was found and handled.');
          // This specific error is handled by the UI to give a good message.
          throw new Error('INCOMPLETE_PAYMENT_FOUND');
      }

      // If the original error from the SDK has a useful code (like USER_CANCELLED), re-throw it so the UI can handle it.
      if (error && error.code) {
          throw error;
      }

      throw new Error('Could not connect to Pi Network. Please ensure you are using the Pi Browser and try again.');
    }
  }

  public async generateLinkCode(): Promise<string> {
    if (DUMMY_MODE) {
      return 'DUMMYCODE';
    }
    if (!this.accessToken) {
        throw new Error("Authentication required to generate a link code.");
    }
    const response = await fetch(`${BACKEND_URL}/generate-link-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: this.accessToken }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Server error generating code.');
    }
    return data.code;
  }

  public async validateLinkCode(code: string): Promise<UserDTO> {
    if (DUMMY_MODE) {
        const dummyUser = { uid: 'linked-dummy-uid', username: 'LinkedPioneer' };
        this.setLinkedUser(dummyUser);
        return dummyUser;
    }
    const response = await fetch(`${BACKEND_URL}/validate-link-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Server error validating code.');
    }
    this.setLinkedUser(data.user);
    return data.user;
  }

  public createPayment(paymentData: any, backendPaymentId: string, callbacks: any) {
    logger.log('createPayment() called.');

    if (DUMMY_MODE) {
        logger.log("Executing createPayment in DUMMY MODE.");
        logger.log(`Dummy payment created with internal ID: ${backendPaymentId}`);
        
        if (callbacks.onReadyForServerApproval) {
            logger.log("Calling onReadyForServerApproval...");
            callbacks.onReadyForServerApproval(`pi_sdk_id_${Date.now()}`);
        }

        setTimeout(() => {
            logger.log("Simulating user confirmation for dummy payment...");
            if (callbacks.onReadyForServerCompletion) {
                logger.log("Calling onReadyForServerCompletion...");
                callbacks.onReadyForServerCompletion();
            }
        }, 1500);
        
        return;
    }

    logger.log("Executing createPayment in LIVE MODE.");
     if (typeof window.Pi?.createPayment !== 'function') {
        const errorMsg = "Pi SDK createPayment not available.";
        logger.log(`ERROR: ${errorMsg}`);
        callbacks.onError(new Error(errorMsg));
        return;
    }
    
    const liveCallbacks = {
        onReadyForServerApproval: async (piPaymentId: string) => {
            logger.log(`Pi Payment ready for server approval: ${piPaymentId}`);
            logger.log(`Checking the payment status for ${backendPaymentId}`);
            try {
                const response = await fetch(`${BACKEND_URL}/approvePayment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        paymentId: backendPaymentId, 
                        piPaymentId: piPaymentId 
                    }),
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Backend approval failed with no message.' }));
                    throw new Error(errorData.error || 'Backend approval failed.');
                }
            } catch (err) {
                logger.log(`Error in onReadyForServerApproval: ${(err as Error).message}`);
                callbacks.onError(err);
            }
        },
        onReadyForServerCompletion: async (piPaymentId: string, txid: string) => {
            logger.log(`onReadyForServerCompletion fired. piPaymentId: ${piPaymentId}, txid: ${txid}`);
            try {
                if (!piPaymentId) {
                    throw new Error('Critical error: Pi Payment ID was not received during completion step.');
                }
                if (!txid) {
                    throw new Error(`Missing transaction ID (TXID) from Pi after user approval for Pi Payment ID ${piPaymentId}.`);
                }
                
                logger.log(`TXID found: ${txid} for Pi Payment ID ${piPaymentId}. Sending to backend...`);

                const response = await fetch(`${BACKEND_URL}/completePayment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        paymentId: backendPaymentId, 
                        piPaymentId: piPaymentId,
                        txid: txid 
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const errorMsg = errorData.error || `Backend completion failed with status ${response.status}.`;
                    logger.log(`ERROR: Backend completion failed for ${backendPaymentId}. Reason: ${errorMsg}`);
                    throw new Error(errorMsg);
                }
                
                logger.log(`Backend completion successful for ${backendPaymentId}. Notifying UI.`);
                callbacks.onReadyForServerCompletion();

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during payment completion.';
                logger.log(`FATAL ERROR during completion for ${backendPaymentId}: ${errorMessage}`);
                callbacks.onError(new Error(`Transaction failed - not completed. ${errorMessage}`));
            }
        },
        onCancel: callbacks.onCancel,
        onError: callbacks.onError,
    };
    
    try {
        logger.log("Calling live Pi.createPayment()...");
        window.Pi.createPayment(paymentData, liveCallbacks);
    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unknown error occurred inside the Pi SDK.';
        logger.log(`FATAL: Synchronous error in Pi.createPayment: ${message}`);
        callbacks.onError(new Error(`Payment failed to start. The Pi SDK may be misconfigured or blocked. Please check your app URL in the Pi Developer Portal. SDK error: ${message}`));
    }
  }
}

export const piService = new PiService();