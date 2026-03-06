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
let wasm: typeof import('@iota/notarization/node') | null = null;

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
    description: string
  ): Promise<NotarizationResult> {
    try {
      const { NotarizationClientReadOnly, NotarizationClient } = await loadWasm();

      const readOnlyClient = await NotarizationClientReadOnly.create(this.iotaClient);
      const signer = buildSigner(this.keypair);
      const client = await NotarizationClient.create(readOnlyClient, signer);

      const txBuilder = client
        .createLocked()
        .withStringState(batchHash, 'sha256')
        .withImmutableDescription(description)
        .finish();

      // buildAndExecute — client satisfies CoreClient<TransactionSigner>
      const result = await txBuilder.buildAndExecute(client as any);

      const digest = result.response.digest;

      // Extract the created notarization object ID from effects
      const created = result.response.effects?.created;
      const objectId = Array.isArray(created) && created.length > 0
        ? (created[0] as any).reference?.objectId
        : undefined;

      console.log(`✅ Notarization anchored: ${digest} | object: ${objectId}`);
      return { success: true, digest, objectId };
    } catch (error: any) {
      console.error('❌ Notarization failed:', error.message ?? error);
      return { success: false, error: error.message ?? String(error) };
    }
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
