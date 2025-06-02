import mqtt from 'mqtt';

class MQTTService {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  connect() {
    const options = {
      protocol: 'wss',
      hostname: 'abbc751b5b434be4ad192133b471d7bb.s1.eu.hivemq.cloud',
      port: 8884,
      path: '/mqtt',
      username: 'hivemq.webclient.1748685268618',
      password: '.W9kNFm>Z8?lM35j%Ana',
      clientId: `mqttjs_${Math.random().toString(16).substr(2, 8)}`,
      clean: true,
      rejectUnauthorized: false,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,
    };

    try {
      const connectUrl = `wss://${options.hostname}:${options.port}${options.path}`;
      this.client = mqtt.connect(connectUrl, options);

      this.client.on('connect', () => {
        console.log('Connected to MQTT broker');
        this.connected = true;
      });

      this.client.on('error', (err) => {
        console.error('MQTT connection error:', err);
        this.connected = false;
      });

      this.client.on('close', () => {
        console.log('MQTT connection closed');
        this.connected = false;
      });

      this.client.on('offline', () => {
        console.log('MQTT client offline');
        this.connected = false;
      });
    } catch (error) {
      console.error('MQTT connection failed:', error);
      this.connected = false;
    }
  }

  publishLedStatus(line, ledIndex, status) {
    if (!this.connected) {
      console.error('MQTT not connected');
      return;
    }

    const topic = `attendance/${line}/led`;
    const message = JSON.stringify({ ledIndex, status });

    this.client.publish(topic, message, { qos: 1 }, (err) => {
      if (err) {
        console.error('MQTT publish error:', err);
      } else {
        console.log(`Published LED status: ${message}`);
      }
    });
  }

  disconnect() {
    if (this.client) {
      this.client.end();
    }
  }
}

export const mqttService = new MQTTService();