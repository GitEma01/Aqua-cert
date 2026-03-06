import dotenv from 'dotenv';
dotenv.config();

const GRAPHQL_URL = process.env.GRAPHQL_URL || 'https://graphql.testnet.iota.cafe';
const PACKAGE_ID = process.env.PACKAGE_ID!;

// ── Generic executor ──────────────────────────────────────────────────────────

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  const json: any = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GlobalCertificate {
  objectId: string;
  ownerAddress: string;
  certificateNumber: string;
  companyName: string;
  periodStart: number;
  periodEnd: number;
  totalLiters: number;
  totalReadings: number;
  footprintClass: string;
  certifier: string;
  issuedAt: number;
}

export interface CertificateEvent {
  certificateId: string;
  certificateNumber: string;
  companyName: string;
  totalLiters: number;
  footprintClass: string;
  issuedAt: number;
  timestamp: string;
  digest: string;
  senderAddress: string;
}

export interface ReadingEvent {
  readingId: string;
  deviceId: string;
  liters: number;
  dataHash: string;
  timestamp: string;
  digest: string;
}

export interface OnChainAnalytics {
  totalCertificates: number;
  totalLitersCertified: number;
  totalOnChainReadings: number;
  uniqueOwners: number;
  footprintDistribution: Record<string, number>;
  recentCertEvents: CertificateEvent[];
  recentReadingEvents: ReadingEvent[];
}

// ── Queries ───────────────────────────────────────────────────────────────────

const CERT_OBJECTS_QUERY = `
  query GetAllCertificates($after: String) {
    objects(
      filter: { type: "${() => PACKAGE_ID}::water_certificate::WaterCertificate" }
      after: $after
      first: 50
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        address
        owner {
          __typename
          ... on AddressOwner { owner { address } }
        }
        asMoveObject {
          contents { json }
        }
      }
    }
  }
`;

const CERT_EVENTS_QUERY = `
  query GetCertificateEvents {
    events(
      filter: { eventType: "${() => PACKAGE_ID}::water_certificate::CertificateIssued" }
      last: 50
    ) {
      nodes {
        json
        timestamp
        transactionBlock { digest }
        sender { address }
      }
    }
  }
`;

const READING_EVENTS_QUERY = `
  query GetReadingEvents {
    events(
      filter: { eventType: "${() => PACKAGE_ID}::water_registry::ReadingRecorded" }
      last: 50
    ) {
      nodes {
        json
        timestamp
        transactionBlock { digest }
        sender { address }
      }
    }
  }
`;

// ── Service ───────────────────────────────────────────────────────────────────

class GraphQLService {
  // Build query strings with the actual PACKAGE_ID at call time
  private certObjectsQuery(): string {
    return `
      query GetAllCertificates($after: String) {
        objects(
          filter: { type: "${PACKAGE_ID}::water_certificate::WaterCertificate" }
          after: $after
          first: 50
        ) {
          pageInfo { hasNextPage endCursor }
          nodes {
            address
            owner {
              __typename
              ... on AddressOwner { owner { address } }
            }
            asMoveObject { contents { json } }
          }
        }
      }
    `;
  }

  private certEventsQuery(): string {
    return `
      query {
        events(
          filter: { eventType: "${PACKAGE_ID}::water_certificate::CertificateIssued" }
          last: 50
        ) {
          nodes {
            json
            timestamp
            transactionBlock { digest }
            sender { address }
          }
        }
      }
    `;
  }

  private readingEventsQuery(): string {
    return `
      query {
        events(
          filter: { eventType: "${PACKAGE_ID}::water_registry::ReadingRecorded" }
          last: 50
        ) {
          nodes {
            json
            timestamp
            transactionBlock { digest }
          }
        }
      }
    `;
  }

  /**
   * Fetches ALL WaterCertificate objects on-chain, across every wallet.
   * Auto-paginates through all pages.
   */
  async getAllCertificates(): Promise<GlobalCertificate[]> {
    const results: GlobalCertificate[] = [];
    let cursor: string | null = null;

    while (true) {
      const data: any = await gql(this.certObjectsQuery(), cursor ? { after: cursor } : {});
      const page = data.objects;

      for (const node of page.nodes) {
        const f = node.asMoveObject?.contents?.json;
        if (!f) continue;
        const ownerAddress = node.owner?.__typename === 'AddressOwner'
          ? node.owner.owner.address
          : 'unknown';

        results.push({
          objectId: node.address,
          ownerAddress,
          certificateNumber: f.certificate_number ?? '',
          companyName: f.company_name ?? '',
          periodStart: Number(f.period_start ?? 0),
          periodEnd: Number(f.period_end ?? 0),
          totalLiters: Number(f.total_liters ?? 0),
          totalReadings: Number(f.total_readings ?? 0),
          footprintClass: f.water_footprint_class ?? '?',
          certifier: f.certifier ?? '',
          issuedAt: Number(f.issued_at ?? 0)
        });
      }

      if (!page.pageInfo.hasNextPage) break;
      cursor = page.pageInfo.endCursor;
    }

    return results.sort((a, b) => b.issuedAt - a.issuedAt);
  }

  /**
   * Fetches the last 50 CertificateIssued events from the chain.
   */
  async getCertificateEvents(): Promise<CertificateEvent[]> {
    const data: any = await gql(this.certEventsQuery());
    return (data.events.nodes as any[]).map(n => ({
      certificateId: n.json.certificate_id ?? '',
      certificateNumber: n.json.certificate_number ?? '',
      companyName: n.json.company_name ?? '',
      totalLiters: Number(n.json.total_liters ?? 0),
      footprintClass: n.json.water_footprint_class ?? '?',
      issuedAt: Number(n.json.issued_at ?? 0),
      timestamp: n.timestamp,
      digest: n.transactionBlock?.digest ?? '',
      senderAddress: n.sender?.address ?? ''
    })).reverse();
  }

  /**
   * Fetches the last 50 ReadingRecorded events from the chain.
   */
  async getReadingEvents(): Promise<ReadingEvent[]> {
    const data: any = await gql(this.readingEventsQuery());
    return (data.events.nodes as any[]).map(n => ({
      readingId: n.json.reading_id ?? '',
      deviceId: n.json.device_id ?? '',
      liters: Number(n.json.liters ?? 0),
      dataHash: n.json.data_hash ?? '',
      timestamp: n.timestamp,
      digest: n.transactionBlock?.digest ?? ''
    })).reverse();
  }

  /**
   * Computes a full analytics snapshot from on-chain data via GraphQL.
   */
  async getOnChainAnalytics(): Promise<OnChainAnalytics> {
    const [certs, certEvents, readingEvents] = await Promise.all([
      this.getAllCertificates(),
      this.getCertificateEvents(),
      this.getReadingEvents()
    ]);

    const totalLitersCertified = certs.reduce((sum, c) => sum + c.totalLiters, 0);
    const uniqueOwners = new Set(certs.map(c => c.ownerAddress)).size;
    const totalOnChainReadings = readingEvents.length; // last 50; real count would need pagination

    const footprintDistribution: Record<string, number> = {};
    for (const cert of certs) {
      footprintDistribution[cert.footprintClass] = (footprintDistribution[cert.footprintClass] ?? 0) + 1;
    }

    return {
      totalCertificates: certs.length,
      totalLitersCertified,
      totalOnChainReadings,
      uniqueOwners,
      footprintDistribution,
      recentCertEvents: certEvents.slice(0, 10),
      recentReadingEvents: readingEvents.slice(0, 10)
    };
  }
}

export const graphqlService = new GraphQLService();
