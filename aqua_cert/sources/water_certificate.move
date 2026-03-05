/// Module: water_certificate
/// NFT che certifica il Water Footprint verificato su blockchain
module aqua_cert::water_certificate {
    use iota::object::{Self, UID, ID};
    use iota::tx_context::{Self, TxContext};
    use iota::transfer;
    use iota::event;
    use iota::clock::{Self, Clock};
    use iota::url::{Self, Url};
    use std::string::{Self, String};
    use std::option::{Self, Option};

    use aqua_cert::water_registry::{WaterRegistry};

    // ============ ERRORI ============
    const EInsufficientData: u64 = 1;
    const EInvalidPeriod: u64 = 2;

    // ============ STRUCTS ============

    /// Capability per emettere certificati
    public struct CertifierCap has key, store {
        id: UID,
        certifier_name: String
    }

    /// Certificato NFT Water Footprint
    public struct WaterCertificate has key, store {
        id: UID,
        // Identificazione
        certificate_number: String,
        company_name: String,
        
        // Periodo certificato
        period_start: u64,
        period_end: u64,
        
        // Dati verificati
        total_liters: u64,
        total_readings: u64,
        water_footprint_class: String,  // "A", "B", "C", "D", "E"
        
        // Metadati
        certifier: String,
        issued_at: u64,
        registry_id: ID,
        
        // Visual
        image_url: Option<Url>,
        description: String
    }

    // ============ EVENTI ============

    public struct CertificateIssued has copy, drop {
        certificate_id: ID,
        certificate_number: String,
        company_name: String,
        total_liters: u64,
        water_footprint_class: String,
        issued_at: u64
    }

    // ============ INIT ============

    fun init(ctx: &mut TxContext) {
        let certifier_cap = CertifierCap {
            id: object::new(ctx),
            certifier_name: string::utf8(b"Aqua-Cert Official")
        };
        transfer::transfer(certifier_cap, tx_context::sender(ctx));
    }

    // ============ FUNZIONI PUBBLICHE ============

    /// Emette un nuovo certificato Water Footprint
    public entry fun issue_certificate(
        certifier: &CertifierCap,
        registry: &WaterRegistry,
        certificate_number: vector<u8>,
        company_name: vector<u8>,
        period_start: u64,
        period_end: u64,
        image_url: vector<u8>,
        clock: &Clock,
        recipient: address,
        ctx: &mut TxContext
    ) {
        // Valida periodo
        assert!(period_end > period_start, EInvalidPeriod);
        
        // Ottieni dati dal registro
        let (total_readings, total_liters, _) = aqua_cert::water_registry::get_registry_stats(registry);
        
        // Richiedi minimo di dati per certificazione
        assert!(total_readings >= 10, EInsufficientData);

        // Calcola classe Water Footprint
        // Classe basata su litri per lettura (efficienza)
        let avg_per_reading = total_liters / total_readings;
        let water_class = calculate_water_class(avg_per_reading);

        let issued_at = clock::timestamp_ms(clock);

        let certificate = WaterCertificate {
            id: object::new(ctx),
            certificate_number: string::utf8(certificate_number),
            company_name: string::utf8(company_name),
            period_start,
            period_end,
            total_liters,
            total_readings,
            water_footprint_class: water_class,
            certifier: certifier.certifier_name,
            issued_at,
            registry_id: object::id(registry),
            image_url: if (vector::length(&image_url) > 0) {
                option::some(url::new_unsafe_from_bytes(image_url))
            } else {
                option::none()
            },
            description: string::utf8(b"Certificato Water Footprint verificato su IOTA Blockchain")
        };

        event::emit(CertificateIssued {
            certificate_id: object::id(&certificate),
            certificate_number: string::utf8(certificate_number),
            company_name: string::utf8(company_name),
            total_liters,
            water_footprint_class: water_class,
            issued_at
        });

        transfer::transfer(certificate, recipient);
    }

    // ============ FUNZIONI HELPER ============

    /// Calcola la classe di efficienza idrica
    fun calculate_water_class(avg_liters_per_reading: u64): String {
        if (avg_liters_per_reading <= 100000) {           // <= 100 L
            string::utf8(b"A")  // Eccellente
        } else if (avg_liters_per_reading <= 500000) {    // <= 500 L
            string::utf8(b"B")  // Buono
        } else if (avg_liters_per_reading <= 1000000) {   // <= 1000 L
            string::utf8(b"C")  // Medio
        } else if (avg_liters_per_reading <= 5000000) {   // <= 5000 L
            string::utf8(b"D")  // Scarso
        } else {
            string::utf8(b"E")  // Critico
        }
    }

    // ============ VIEW FUNCTIONS ============

    public fun get_certificate_info(cert: &WaterCertificate): (String, String, u64, String) {
        (
            cert.certificate_number,
            cert.company_name,
            cert.total_liters,
            cert.water_footprint_class
        )
    }

    public fun get_certificate_period(cert: &WaterCertificate): (u64, u64) {
        (cert.period_start, cert.period_end)
    }

    public fun verify_certificate(cert: &WaterCertificate, registry: &WaterRegistry): bool {
        cert.registry_id == object::id(registry)
    }

    // ============ TEST ============
    #[test_only]
    public fun test_init(ctx: &mut TxContext) {
        init(ctx);
    }
}
