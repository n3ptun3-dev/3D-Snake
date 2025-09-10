import { AuthResult, UserDTO, PiScopes, PaymentDTO } from '../types';
import { logger } from './logger';
import { BACKEND_URL } from '../config';

// To switch between real Pi integration and testing, set this flag.
// true: Simulates API calls with dummy data, no real Pi transactions.
// false: Uses the live Pi SDK for authentication and payments.
export const DUMMY_MODE = false;

class PiService {
  private user: UserDTO | null = null;
  private accessToken: string | null = null;
  private onAuthUpdateCallbacks: ((user: UserDTO | null) => void)[] = [];

  private setUser(auth: AuthResult | null) {
    this.user = auth ? auth.user : null;
    this.accessToken = auth ? auth.accessToken : null;
    this.onAuthUpdateCallbacks.forEach(cb => cb(this.user));
    logger.log(`User set to: ${this.user ? this.user.username : 'null'}`);
  }

  public subscribe(callback: (user: UserDTO | null) => void): () => void {
    this.onAuthUpdateCallbacks.push(callback);
    callback(this.user);
    return () => {
        this.onAuthUpdateCallbacks = this.onAuthUpdateCallbacks.filter(cb => cb !== callback);
    };
  }

  public getCurrentUser(): UserDTO | null {
    return this.user;
  }

  public isDummyMode(): boolean {
    return DUMMY_MODE;
  }
  
  /**
   * Initializes the Pi SDK. This should be called once when the application starts.
   * It waits for the SDK script to load, then calls Pi.init().
   */
  public async initSdk(): Promise<void> {
    logger.log('Attempting to initialize Pi SDK...');
    if (DUMMY_MODE) {
      logger.log('DUMMY_MODE: Skipping live SDK initialization.');
      return;
    }

    if (typeof window.Pi === 'undefined') {
      logger.log('Pi SDK script not loaded yet (window.Pi is undefined). Waiting...');
      await new Promise<void>((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(() => {
          if (typeof window.Pi !== 'undefined') {
            clearInterval(interval);
            logger.log(`Pi SDK script loaded after ~${attempts * 100}ms.`);
            resolve();
          } else {
            attempts++;
            if (attempts > 50) { // Wait for up to 5 seconds
              clearInterval(interval);
              reject(new Error('Pi SDK script did not load in time.'));
            }
          }
        }, 100);
      });
    }

    try {
      logger.log('Calling Pi.init({ version: "2.0", sandbox: true })...');
      window.Pi.init({ version: "2.0", sandbox: true });
      logger.log('Pi.init() called successfully.');
    } catch (err) {
      const errorMsg = `An error occurred during Pi.init(): ${err instanceof Error ? err.message : String(err)}`;
      logger.log(`ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  public async authenticate(): Promise<UserDTO> {
    logger.log('authenticate() called.');
    logger.log(`DUMMY_MODE is: ${DUMMY_MODE}`);
    
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
    try {
      if (typeof window.Pi?.authenticate !== 'function') {
        const errorMsg = "Pi SDK is not ready for authentication. Please ensure you are in the Pi Browser and the app has fully loaded.";
        logger.log(`ERROR: ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      logger.log("Pi.authenticate() is available. Calling it now...");
      const scopes: PiScopes = ['username', 'payments'];
      
      const onIncompletePaymentFound = async (payment: PaymentDTO) => {
        logger.log(`Incomplete payment found: ${payment.identifier}. Sending to backend for completion.`);
        try {
          await fetch(`${BACKEND_URL}/handleIncompletePayment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment }),
          });
        } catch (err) {
            console.error('Failed to send incomplete payment to backend:', err);
            logger.log(`ERROR: Failed to handle incomplete payment ${payment.identifier}.`);
        }
      };

      const authResult: AuthResult = await window.Pi.authenticate(scopes, onIncompletePaymentFound);
      logger.log(`Pi.authenticate() succeeded for user: ${authResult.user.username}. Verifying with backend...`);

      const verificationResponse = await fetch(`${BACKEND_URL}/verifyAuth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: authResult.accessToken }),
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
      logger.log(`Pi authentication process FAILED. Error: ${error?.message || 'Unknown error'}`);
      console.error('Pi authentication failed:', error);
      this.setUser(null);
      // Create a more user-friendly, consolidated error message.
      throw new Error('Could not connect to Pi Network. Please ensure you are using the Pi Browser and try again.');
    }
  }

  public createPayment(paymentData: any, callbacks: any) {
    logger.log('createPayment() called.');
    logger.log(`DUMMY_MODE is: ${DUMMY_MODE}`);
    if (DUMMY_MODE) {
        logger.log("Executing createPayment in DUMMY MODE.");
        const dummyPaymentId = `dummy_payment_${Date.now()}`;
        
        logger.log(`Dummy payment created with ID: ${dummyPaymentId}`);
        
        if (callbacks.onReadyForServerApproval) {
            logger.log("Calling onReadyForServerApproval...");
            callbacks.onReadyForServerApproval(dummyPaymentId);
        }

        setTimeout(() => {
            logger.log("Simulating user confirmation for dummy payment...");
            if (callbacks.onReadyForServerCompletion) {
                const dummyPaymentObject: PaymentDTO = {
                    ...paymentData,
                    identifier: dummyPaymentId,
                    user_uid: this.user?.uid || `dummy-uid-${Date.now()}`,
                    status: {
                        developer_approved: true,
                        transaction_verified: true,
                        developer_completed: false,
                        cancelled: false,
                        user_cancelled: false,
                    },
                    // Fix: Add transaction object to dummy data to match real SDK response
                    // and allow dummy mode to function correctly.
                    transaction: {
                        txid: `dummy_txid_${Date.now()}`,
                    },
                };
                logger.log("Calling onReadyForServerCompletion...");
                callbacks.onReadyForServerCompletion(dummyPaymentObject);
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
    logger.log("Calling live Pi.createPayment()...");
    window.Pi.createPayment(paymentData, callbacks);
  }
}

export const piService = new PiService();
