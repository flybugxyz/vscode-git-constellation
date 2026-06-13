import * as https from 'https';
import * as http from 'http';

export function requestAIApi(
  apiUrl: string,
  apiKey: string,
  body: any,
  signal?: AbortSignal,
  onChunk?: (text: string) => void
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

    if (onChunk) {
      body = { ...body, stream: true };
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
      const isStream = !!onChunk && res.statusCode && res.statusCode < 400;
      let data = '';
      let buffer = '';
      let accumulatedText = '';

      res.on('data', (chunk) => {
        if (isStream) {
          buffer += chunk.toString();
          let lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.slice(5).trim();
              if (dataStr === '[DONE]') {
                continue;
              }
              try {
                const parsed = JSON.parse(dataStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  onChunk(content);
                  accumulatedText += content;
                }
              } catch (e) {
                // Ignore parse errors on SSE format in case of intermediate/malformed chunks
              }
            }
          }
        } else {
          data += chunk;
        }
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          try {
            const errBody = JSON.parse(data);
            return reject(new Error(errBody.error?.message || `HTTP ${res.statusCode}: ${data}`));
          } catch {
            return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        }

        if (isStream) {
          if (buffer) {
            const trimmed = buffer.trim();
            if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.slice(5).trim();
              if (dataStr !== '[DONE]') {
                try {
                  const parsed = JSON.parse(dataStr);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    onChunk(content);
                    accumulatedText += content;
                  }
                } catch (e) {
                  // Ignore
                }
              }
            }
          }
          resolve({
            choices: [{
              message: {
                content: accumulatedText
              }
            }]
          });
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON response from API'));
          }
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
