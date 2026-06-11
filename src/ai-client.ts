import * as https from 'https';
import * as http from 'http';

export function requestAIApi(
  apiUrl: string,
  apiKey: string,
  body: any,
  signal?: AbortSignal
): Promise<any> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error('Request aborted'));
    }

    let url: URL;
    try {
      url = new URL(apiUrl);
    } catch (e) {
      return reject(new Error('Invalid API URL'));
    }

    // Security policy removed to allow local models on custom network hostnames via HTTP.
    const options: https.RequestOptions & http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    };

    if (signal) {
      options.signal = signal;
    }

    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          try {
            const errBody = JSON.parse(data);
            return reject(new Error(errBody.error?.message || `HTTP ${res.statusCode}: ${data}`));
          } catch {
            return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response from API'));
        }
      });
    });

    req.on('error', (e) => {
      if (signal?.aborted || e.message === 'The operation was aborted') {
        reject(new Error('Request aborted'));
      } else {
        reject(e);
      }
    });

    if (signal) {
      signal.addEventListener('abort', () => {
        req.destroy(new Error('Request aborted'));
      });
    }

    req.write(JSON.stringify(body));
    req.end();
  });
}
