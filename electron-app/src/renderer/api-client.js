/**
 * API Client con reintentos, timeouts y manejo robusto de errores
 * Usado por Electron para comunicarse con backends C# y Python
 */

class APIClient {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl;
    this.timeout = options.timeout || 5000;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.onError = options.onError || (() => {});
    this.onRetry = options.onRetry || (() => {});
  }

  /**
   * Fetch con timeout
   */
  async fetchWithTimeout(url, options = {}, timeoutMs = null) {
    const timeout = timeoutMs || this.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout después de ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Request con reintentos y exponential backoff
   */
  async requestWithRetry(url, options = {}, attempt = 1) {
    try {
      const response = await this.fetchWithTimeout(url, options);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (attempt < this.maxRetries) {
        const delay = Math.pow(2, attempt - 1) * this.retryDelay;
        console.warn(
          `⚠️ Intento ${attempt}/${this.maxRetries} fallido (${error.message}). ` +
          `Reintentando en ${delay}ms...`
        );
        this.onRetry({ attempt, delay, error });
        await new Promise(r => setTimeout(r, delay));
        return this.requestWithRetry(url, options, attempt + 1);
      }

      console.error(`❌ Error después de ${this.maxRetries} intentos:`, error);
      this.onError({ error, url, attempt });
      throw error;
    }
  }

  /**
   * GET request
   */
  async get(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const response = await this.requestWithRetry(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    return response.json();
  }

  /**
   * POST request
   */
  async post(path, body = {}, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const response = await this.requestWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: JSON.stringify(body)
    });
    return response.json();
  }

  /**
   * Validar que el servidor está disponible
   */
  async healthCheck() {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/health`, {
        method: 'GET'
      }, 3000);
      return response.ok;
    } catch (error) {
      console.warn(`⚠️ Health check fallido para ${this.baseUrl}:`, error.message);
      return false;
    }
  }
}

/**
 * Instancias globales de API clients
 */
const csharpAPI = new APIClient('http://localhost:5000/api', {
  timeout: 5000,
  maxRetries: 3,
  retryDelay: 1000,
  onError: (info) => {
    console.error('❌ Error en C# API:', info);
    // Notificar a la UI
    const event = new CustomEvent('api-error', {
      detail: { source: 'csharp', ...info }
    });
    document.dispatchEvent(event);
  },
  onRetry: (info) => {
    console.warn(`⚠️ Reintentando C# API (intento ${info.attempt}/${3})`);
  }
});

const pythonAPI = new APIClient('http://127.0.0.1:8765', {
  timeout: 5000,
  maxRetries: 2,
  retryDelay: 1500,
  onError: (info) => {
    console.error('❌ Error en Python API:', info);
    const event = new CustomEvent('api-error', {
      detail: { source: 'python', ...info }
    });
    document.dispatchEvent(event);
  },
  onRetry: (info) => {
    console.warn(`⚠️ Reintentando Python API (intento ${info.attempt}/${2})`);
  }
});

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { APIClient, csharpAPI, pythonAPI };
}
