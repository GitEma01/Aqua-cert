/// Module: water_registry
/// Registra i dati di consumo idrico da sensori IoT su IOTA
module aqua_cert::water_registry {
    use iota::object::{Self, UID, ID};
    use iota::tx_context::{Self, TxContext};
    use iota::transfer;
    use iota::event;
    use iota::clock::{Self, Clock};
    use std::string::{Self, String};
    use std::vector;

    // ============ ERRORI ============
    const ENotAuthorized: u64 = 1;
    const EInvalidReading: u64 = 2;
    const EDeviceNotRegistered: u64 = 3;

    // ============ STRUCTS ============
    
    /// Capability per amministrare il sistema
    public struct AdminCap has key, store {
        id: UID
    }

    /// Capability per un dispositivo IoT registrato
    public struct DeviceCap has key, store {
        id: UID,
        device_id: String,
        location: String,
        device_type: String  // "irrigation", "industrial", "datacenter"
    }

    /// Singola lettura del sensore (oggetto immutabile)
    public struct WaterReading has key, store {
        id: UID,
        device_id: String,
        liters: u64,              // Litri consumati (x1000 per 3 decimali)
        timestamp: u64,           // Unix timestamp in ms
        data_hash: String,        // SHA-256 dei dati grezzi
        cumulative_total: u64     // Totale cumulativo dispositivo
    }

    /// Registro condiviso di tutte le letture per azienda
    public struct WaterRegistry has key {
        id: UID,
        company_name: String,
        total_readings: u64,
        total_liters: u64,
        devices: vector<String>,
        created_at: u64
    }

    // ============ EVENTI ============

    public struct DeviceRegistered has copy, drop {
        device_id: String,
        location: String,
        device_type: String,
        registry_id: ID
    }

    public struct ReadingRecorded has copy, drop {
        reading_id: ID,
        device_id: String,
        liters: u64,
        timestamp: u64,
        data_hash: String
    }

    public struct RegistryCreated has copy, drop {
        registry_id: ID,
        company_name: String,
        created_at: u64
    }

    // ============ INIT ============
    
    /// Inizializza il modulo e crea AdminCap per il deployer
    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap {
            id: object::new(ctx)
        };
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    // ============ FUNZIONI PUBBLICHE ============

    /// Crea un nuovo registro per un'azienda
    public entry fun create_registry(
        _admin: &AdminCap,
        company_name: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let registry = WaterRegistry {
            id: object::new(ctx),
            company_name: string::utf8(company_name),
            total_readings: 0,
            total_liters: 0,
            devices: vector::empty(),
            created_at: clock::timestamp_ms(clock)
        };

        event::emit(RegistryCreated {
            registry_id: object::id(&registry),
            company_name: string::utf8(company_name),
            created_at: clock::timestamp_ms(clock)
        });

        transfer::share_object(registry);
    }

    /// Registra un nuovo dispositivo IoT
    public entry fun register_device(
        _admin: &AdminCap,
        registry: &mut WaterRegistry,
        device_id: vector<u8>,
        location: vector<u8>,
        device_type: vector<u8>,
        ctx: &mut TxContext
    ) {
        let device_id_str = string::utf8(device_id);
        
        // Aggiungi al registro
        vector::push_back(&mut registry.devices, device_id_str);

        // Crea capability per il dispositivo
        let device_cap = DeviceCap {
            id: object::new(ctx),
            device_id: device_id_str,
            location: string::utf8(location),
            device_type: string::utf8(device_type)
        };

        event::emit(DeviceRegistered {
            device_id: device_id_str,
            location: string::utf8(location),
            device_type: string::utf8(device_type),
            registry_id: object::id(registry)
        });

        // Trasferisci al sender (che gestirà il dispositivo)
        transfer::transfer(device_cap, tx_context::sender(ctx));
    }

    /// Registra una nuova lettura dal sensore IoT
    public entry fun record_reading(
        device_cap: &DeviceCap,
        registry: &mut WaterRegistry,
        liters: u64,
        data_hash: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(liters > 0, EInvalidReading);

        let timestamp = clock::timestamp_ms(clock);
        
        // Aggiorna totali registro
        registry.total_readings = registry.total_readings + 1;
        registry.total_liters = registry.total_liters + liters;

        // Crea lettura immutabile
        let reading = WaterReading {
            id: object::new(ctx),
            device_id: device_cap.device_id,
            liters,
            timestamp,
            data_hash: string::utf8(data_hash),
            cumulative_total: registry.total_liters
        };

        event::emit(ReadingRecorded {
            reading_id: object::id(&reading),
            device_id: device_cap.device_id,
            liters,
            timestamp,
            data_hash: string::utf8(data_hash)
        });

        // Rendi la lettura immutabile e pubblica
        transfer::freeze_object(reading);
    }

    // ============ VIEW FUNCTIONS ============

    public fun get_registry_stats(registry: &WaterRegistry): (u64, u64, u64) {
        (registry.total_readings, registry.total_liters, registry.created_at)
    }

    public fun get_device_info(device_cap: &DeviceCap): (String, String, String) {
        (device_cap.device_id, device_cap.location, device_cap.device_type)
    }

    public fun get_reading_data(reading: &WaterReading): (String, u64, u64, String) {
        (reading.device_id, reading.liters, reading.timestamp, reading.data_hash)
    }

    // ============ TEST ============
    #[test_only]
    public fun test_init(ctx: &mut TxContext) {
        init(ctx);
    }
}
