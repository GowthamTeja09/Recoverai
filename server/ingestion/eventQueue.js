import { EventEmitter } from 'events';
import crypto from 'crypto';

class EventQueue extends EventEmitter {
  constructor() {
    super();
    this.stream = [];
    this.consumerGroups = new Map();
    this.processing = false;
    this.listenersRegistered = false;
  }

  async enqueue(event) {
    const streamId = `${Date.now()}-${this.stream.length + 1}`;
    const entry = {
      streamId,
      id: event.eventId,
      data: event,
      status: 'PENDING',
      attempts: 0,
      enqueuedAt: new Date().toISOString()
    };

    this.stream.push(entry);
    this.emit('event:enqueued', entry);

    // Auto trigger pipeline processing
    setImmediate(() => this.processNext());
    return entry;
  }

  async processNext() {
    if (this.processing) return;
    const nextItem = this.stream.find(item => item.status === 'PENDING');
    if (!nextItem) return;

    this.processing = true;
    nextItem.status = 'IN_FLIGHT';
    nextItem.attempts += 1;

    try {
      this.emit('event:process', nextItem);
    } catch (err) {
      console.error('Queue processing error:', err);
      nextItem.status = 'FAILED';
      nextItem.error = err.message;
    } finally {
      this.processing = false;
      // Continue draining queue
      if (this.stream.some(item => item.status === 'PENDING')) {
        setImmediate(() => this.processNext());
      }
    }
  }

  acknowledge(streamId) {
    const item = this.stream.find(i => i.streamId === streamId);
    if (item) {
      item.status = 'ACKNOWLEDGED';
      item.processedAt = new Date().toISOString();
    }
  }

  getMetrics() {
    return {
      totalQueued: this.stream.length,
      pending: this.stream.filter(i => i.status === 'PENDING').length,
      inFlight: this.stream.filter(i => i.status === 'IN_FLIGHT').length,
      acknowledged: this.stream.filter(i => i.status === 'ACKNOWLEDGED').length,
      failed: this.stream.filter(i => i.status === 'FAILED').length
    };
  }
}

export const eventQueue = new EventQueue();
