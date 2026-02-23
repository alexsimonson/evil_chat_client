/**
 * LiveKit sync layer for collaborative DAW editing
 * Handles broadcasting and receiving operations via DataChannel
 */

import { Room, RoomEvent } from 'livekit-client';
import type { DawOp } from '../state/ops';
import { DawOpSchema } from '../state/ops';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface SyncConfig {
  room: Room;
  clientId: string;
  onOpReceived: (op: DawOp) => void;
  onSyncRequest: (fromClientId: string) => void;
}

export class LiveKitSync {
  private room: Room;
  private clientId: string;
  private onOpReceived: (op: DawOp) => void;
  private onSyncRequest: (fromClientId: string) => void;
  private isHost: boolean = false;
  private positionTickInterval: number | null = null;

  constructor(config: SyncConfig) {
    this.room = config.room;
    this.clientId = config.clientId;
    this.onOpReceived = config.onOpReceived;
    this.onSyncRequest = config.onSyncRequest;

    // Determine if we're the host (first participant)
    this.isHost = this.room.remoteParticipants.size === 0;

    // Listen for data messages
    this.setupDataListener();
  }

  /**
   * Check if this client is the transport host
   */
  isTransportHost(): boolean {
    return this.isHost;
  }

  /**
   * Set up data channel listener
   */
  private setupDataListener() {
    this.room.on(RoomEvent.DataReceived, (payload: Uint8Array, _participant, _kind) => {
      try {
        const message = JSON.parse(textDecoder.decode(payload));
        
        if (message.type === 'DAW_OP') {
          // Validate and process operation
          const result = DawOpSchema.safeParse(message.op);
          if (result.success) {
            this.onOpReceived(result.data);
          } else {
            console.warn('Invalid op received:', result.error);
          }
        } else if (message.type === 'SYNC_REQUEST') {
          // Another client is requesting full state
          this.onSyncRequest(message.clientId);
        } else if (message.type === 'SYNC_RESPONSE') {
          // Receiving full state (handled by caller)
          console.log('Sync response received');
        }
      } catch (error) {
        console.error('Error processing data message:', error);
      }
    });
  }

  /**
   * Broadcast an operation to all clients
   */
  broadcastOp(op: DawOp) {
    const message = {
      type: 'DAW_OP',
      op,
    };

    const payload = textEncoder.encode(JSON.stringify(message));
    this.room.localParticipant.publishData(payload, {
      reliable: true,
      destinationIdentities: undefined, // Send to all
    });
  }

  /**
   * Request sync from other clients (when joining)
   */
  requestSync() {
    const message = {
      type: 'SYNC_REQUEST',
      clientId: this.clientId,
    };

    const payload = textEncoder.encode(JSON.stringify(message));
    this.room.localParticipant.publishData(payload, {
      reliable: true,
    });
  }

  /**
   * Send full state to a specific client
   */
  sendFullState(state: any, targetClientId: string) {
    const message = {
      type: 'SYNC_RESPONSE',
      state,
    };

    const payload = textEncoder.encode(JSON.stringify(message));
    this.room.localParticipant.publishData(payload, {
      reliable: true,
      destinationIdentities: [targetClientId],
    });
  }

  /**
   * Start broadcasting transport position ticks (host only)
   */
  startPositionTicks(getCurrentPosition: () => number, createTickOp: (pos: number) => DawOp) {
    if (!this.isHost) {
      console.warn('Only host should broadcast position ticks');
      return;
    }

    if (this.positionTickInterval) {
      clearInterval(this.positionTickInterval);
    }

    this.positionTickInterval = setInterval(() => {
      const position = getCurrentPosition();
      const tickOp = createTickOp(position);
      this.broadcastOp(tickOp);
    }, 250); // Broadcast every 250ms
  }

  /**
   * Stop broadcasting position ticks
   */
  stopPositionTicks() {
    if (this.positionTickInterval) {
      clearInterval(this.positionTickInterval);
      this.positionTickInterval = null;
    }
  }

  /**
   * Clean up
   */
  dispose() {
    this.stopPositionTicks();
    this.room.removeAllListeners(RoomEvent.DataReceived);
  }
}
