import { VERBOSE_LOGGING } from '../config';

const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfYu2gGov8xS1zrq_k6lNX1DPqOHrmOlEPDO1V4iAa1UUQmCg/formResponse';
const LOG_ENTRY_ID = 'entry.1607577330';

class LoggerService {
  public log(message: string) {
    if (!VERBOSE_LOGGING) {
        return;
    }

    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A';
    const finalMessage = `[UA: ${userAgent}] [${new Date().toISOString()}] ${message}`;
    
    // Log to console for local development visibility
    console.log(finalMessage);

    // Send to Google Form
    this.sendToGoogleForm(finalMessage);
  }

  private async sendToGoogleForm(message: string) {
    const formData = new FormData();
    formData.append(LOG_ENTRY_ID, message);

    try {
      await fetch(GOOGLE_FORM_URL, {
        method: 'POST',
        body: formData,
        mode: 'no-cors', // We don't need the response, and this avoids CORS issues.
      });
      // We can't check for success with no-cors, but we assume it worked if no network error was thrown.
    } catch (error) {
      console.error('Failed to send log to Google Form:', error);
    }
  }
}

// Export a singleton instance
export const logger = new LoggerService();