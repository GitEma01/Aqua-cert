import { IotaClient } from '@iota/iota-sdk/client';
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';
import dotenv from 'dotenv';

dotenv.config();

export interface NotarizationResult {
  success: boolean;
  objectId?: string;
  digest?: string;
  error?: string;
}

// Lazy-loaded WASM module — avoids top-level await issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wasm: any = null;

async function loadWasm() {
  if (wasm) return wasm;
  wasm = await import('@iota/notarization/node');
  return wasm;
}

// Build a TransactionSigner compatible with the notarization WASM from an Ed25519Keypair
function buildSigner(keypair: Ed25519Keypair) {
  return {
    sign: async (txDataBcs: Uint8Array): Promise<string> => {
      // signTransaction handles: messageWithIntent → blake2b hash → sign → serialize
      const { signature } = await keypair.signTransaction(txDataBcs);
      return signature;
    },
    publicKey: async () => keypair.getPublicKey(),
    // WASM expects [scheme_flag (1 byte) | raw_pubkey (32 bytes)] = 33 bytes
    iotaPublicKeyBytes: async () => {
      const raw = keypair.getPublicKey().toRawBytes();
      const flag = keypair.getPublicKey().flag();
      const result = new Uint8Array(raw.length + 1);
      result[0] = flag;
      result.set(raw, 1);
      return result;
    },
    keyId: () => keypair.getPublicKey().toIotaAddress()
  };
}

class NotarizationService {
  private iotaClient: IotaClient;
  private keypair: Ed25519Keypair;

  constructor() {
    const networkUrl = process.env.IOTA_NETWORK_URL || 'https://api.testnet.iota.cafe';
    this.iotaClient = new IotaClient({ url: networkUrl });

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) throw new Error('PRIVATE_KEY not configured in .env');
    this.keypair = Ed25519Keypair.fromSecretKey(
      Buffer.from(privateKey.replace(/^0x/, ''), 'hex')
    );
  }

  /**
   * Anchors a data hash on-chain as a Locked notarization.
   * A Locked notarization is immutable — perfect for IoT batch proofs.
   */
  async notarizeBatchHash(
    batchHash: string,
    description: string,
    maxRetries = 4
  ): Promise<NotarizationResult> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { NotarizationClientReadOnly, NotarizationClient } = await loadWasm();

        // Create fresh client each attempt so WASM re-fetches current coin versions
        const readOnlyClient = await NotarizationClientReadOnly.create(this.iotaClient);
        const signer = buildSigner(this.keypair);
        const client = await NotarizationClient.create(readOnlyClient, signer);

        const txBuilder = client
          .createLocked()
          .withStringState(batchHash, 'sha256')
          .withImmutableDescription(description)
          .finish();

        const result = await txBuilder.buildAndExecute(client as any);

        const digest = result.response.digest;
        const created = result.response.effects?.created;
        const objectId = Array.isArray(created) && created.length > 0
          ? (created[0] as any).reference?.objectId
          : undefined;

        console.log(`✅ Notarization anchored: ${digest} | object: ${objectId}`);
        return { success: true, digest, objectId };
      } catch (error: any) {
        lastError = error;
        const msg: string = error?.message ?? String(error);
        const isLockError =
          msg.includes('reserved for another transaction') ||
          msg.includes('is not available for consumption') ||
          msg.includes('locked');

        if (isLockError && attempt < maxRetries) {
          console.warn(`⚠️  Notarization attempt ${attempt}/${maxRetries} hit locked coin, retrying in 3s...`);
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }

        console.error('❌ Notarization failed:', msg);
        return { success: false, error: msg };
      }
    }

    return { success: false, error: lastError?.message ?? String(lastError) };
  }

  /**
   * Anchor a certificate issuance proof with gas station (if configured).
   * Falls back to direct notarization if no gas station is configured.
   */
  async notarizeWithGasStation(
    batchHash: string,
    description: string
  ): Promise<NotarizationResult> {
    const gasStationUrl = process.env.GAS_STATION_URL;
    if (!gasStationUrl) {
      return this.notarizeBatchHash(batchHash, description);
    }

    try {
      const { NotarizationClientReadOnly, NotarizationClient, DefaultHttpClient, GasStationParams } = await loadWasm();

      const readOnlyClient = await NotarizationClientReadOnly.create(this.iotaClient);
      const signer = buildSigner(this.keypair);
      const client = await NotarizationClient.create(readOnlyClient, signer);

      const txBuilder = client
        .createLocked()
        .withStringState(batchHash, 'sha256')
        .withImmutableDescription(description)
        .finish();

      const httpClient = new DefaultHttpClient();
      const gasToken = process.env.GAS_STATION_TOKEN;
      const gasParams = gasToken
        ? new GasStationParams().withAuthToken(gasToken)
        : new GasStationParams();

      const result = await txBuilder.executeWithGasStation(
        client as any,
        gasStationUrl,
        httpClient,
        gasParams
      );

      const digest = result.response.digest;
      const created = result.response.effects?.created;
      const objectId = Array.isArray(created) && created.length > 0
        ? (created[0] as any).reference?.objectId
        : undefined;

      console.log(`✅ Gas-sponsored notarization anchored: ${digest}`);
      return { success: true, digest, objectId };
    } catch (error: any) {
      console.error('❌ Gas-station notarization failed, falling back:', error.message ?? error);
      // Fallback to direct notarization
      return this.notarizeBatchHash(batchHash, description);
    }
  }
}

export const notarizationService = new NotarizationService();
