import { AuthResult, UserDTO, PiScopes, PaymentDTO } from '../types';

class PiService {
  // To switch between real Pi integration and testing, set this flag.
  // true: Simulates API calls with dummy data, no real Pi transactions.
  // false: Uses the live Pi SDK for authentication and payments.
  private DUMMY_MODE = true;

  private user: UserDTO | null = null;
  private accessToken: string | null = null;
  private onAuthUpdateCallbacks: ((user: UserDTO | null) => void)[] = [];

  private setUser(auth: AuthResult | null) {
    this.user = auth ? auth.user : null;
    this.accessToken = auth ? auth.accessToken : null;
    this.onAuthUpdateCallbacks.forEach(cb => cb(this.user));
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
    return this.DUMMY_MODE;
  }

  public async authenticate(): Promise<UserDTO> {
    if (this.DUMMY_MODE) {
        console.warn("Pi authentication is in DUMMY MODE for testing.");
        const dummyUser: UserDTO = {
            uid: `dummy-uid-${Date.now()}`,
            username: 'TestPioneer',
        };
        const dummyAuthResult: AuthResult = {
            accessToken: 'dummy-access-token',
            user: dummyUser,
        };
        this.setUser(dummyAuthResult);
        // Simulate network delay for a more realistic feel
        return new Promise(resolve => setTimeout(() => resolve(dummyUser), 500));
    }

    if (typeof window.Pi?.authenticate !== 'function') {
        throw new Error("Pi SDK is not available. Please open this app in the Pi Browser.");
    }
    
    try {
      const scopes: PiScopes = ['username', 'payments'];
      const onIncompletePaymentFound = (payment: PaymentDTO) => {
        console.log('Incomplete payment found:', payment);
      };

      const authResult: AuthResult = await window.Pi.authenticate(scopes, onIncompletePaymentFound);
      this.setUser(authResult);
      return authResult.user;
    } catch (error: any) {
      console.error('Pi authentication failed:', error);
      this.setUser(null);
      throw error;
    }
  }

  public createPayment(paymentData: any, callbacks: any) {
    if (this.DUMMY_MODE) {
        console.warn("Pi createPayment is in DUMMY MODE for testing.");
        const dummyPaymentId = `dummy_payment_${Date.now()}`;
        
        console.log("Dummy payment created:", { ...paymentData, identifier: dummyPaymentId });
        
        // onReadyForServerApproval is called by Pi SDK when the payment is created.
        if (callbacks.onReadyForServerApproval) {
            callbacks.onReadyForServerApproval(dummyPaymentId);
        }

        // Simulate user confirming payment in the dialog
        setTimeout(() => {
            console.log("Simulating user confirmation...");
            // onReadyForServerCompletion is called after user confirmation.
            if (callbacks.onReadyForServerCompletion) {
                const dummyPaymentObject = {
                    ...paymentData,
                    identifier: dummyPaymentId,
                    status: {
                        developer_approved: true,
                        transaction_verified: true,
                        developer_completed: false, // This will be set true by our server call
                        cancelled: false,
                        user_cancelled: false,
                    },
                };
                callbacks.onReadyForServerCompletion(dummyPaymentObject);
            }
        }, 1500); // 1.5 second delay to simulate user action
        
        return;
    }

     if (typeof window.Pi?.createPayment !== 'function') {
        callbacks.onError(new Error("Pi SDK not available."), null);
        return;
    }
    window.Pi.createPayment(paymentData, callbacks);
  }
}

export const piService = new PiService();