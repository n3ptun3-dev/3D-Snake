import { AuthResult, UserDTO, PiScopes, PaymentDTO } from '../types';
import { logger } from './logger';
import { PI_SANDBOX, BACKEND_URL, DUMMY_MODE } from '../config';

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

  /**
   * Waits for the Pi SDK to be loaded by the static script tag in index.html.
   */
  private async waitForPiSdk(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = 10000; // 10 seconds
      const interval = 100; // check every 100ms
      let elapsedTime = 0;

      logger.log('Waiting for Pi SDK script to load...');
      const check = () => {
        if (typeof window.Pi?.init === 'function') {
          logger.log(`Pi SDK is ready after ${elapsedTime}ms.`);
          resolve();
        } else {
          elapsedTime += interval;
          if (elapsedTime >= timeout) {
            reject(new Error(`Pi SDK did not load within ${timeout / 1000} seconds. Check network or script tag.`));
          } else {
            setTimeout(check, interval);
          }
        }
      };
      check();
    });
  }
  
  /**
   * Initializes the Pi SDK. Assumes the SDK is loaded via a static <script> tag.
   */
  public async initSdk(): Promise<void> {
    logger.log('Attempting to initialize Pi SDK...');
    if (DUMMY_MODE) {
      logger.log('DUMMY_MODE: Skipping live SDK initialization.');
      return;
    }

    try {
      await this.waitForPiSdk();
      logger.log(`Calling Pi.init({ version: "2.0", sandbox: ${PI_SANDBOX} })...`);
      window.Pi.init({ version: "2.0", sandbox: PI_SANDBOX });
      logger.log('Pi.init() called successfully.');
    } catch (err) {
      const errorMsg = `An error occurred during Pi SDK initialization: ${err instanceof Error ? err.message : String(err)}`;
      logger.log(`ERROR: ${errorMsg}`);
      throw new Error(errorMsg); // Re-throw to be caught in index.tsx
    }
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