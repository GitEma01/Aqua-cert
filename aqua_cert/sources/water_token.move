/// Module: water_token
/// Token fungibile che rappresenta crediti di efficienza idrica
module aqua_cert::water_token {
    use iota::object::{Self, UID};
    use iota::tx_context::{Self, TxContext};
    use iota::transfer;
    use iota::balance::{Self, Supply, Balance};
    use iota::coin::{Self, Coin, TreasuryCap};
    use iota::event;
    use std::string::{Self, String};
    use std::option;

    // ============ STRUCTS ============

    /// One-Time Witness per il token
    public struct WATER_TOKEN has drop {}

    /// Metadati del token
    public struct WaterTokenInfo has key {
        id: UID,
        name: String,
        symbol: String,
        description: String,
        total_minted: u64,
        total_burned: u64
    }

    // ============ EVENTI ============

    public struct TokensMinted has copy, drop {
        amount: u64,
        recipient: address,
        reason: String
    }

    public struct TokensBurned has copy, drop {
        amount: u64,
        burner: address
    }

    // ============ INIT ============

    /// Inizializza il token WATER
    fun init(witness: WATER_TOKEN, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency(
            witness,
            6,  // 6 decimali
            b"WATER",
            b"Water Credit Token",
            b"Token che rappresenta crediti di efficienza idrica certificati su IOTA",
            option::none(),
            ctx
        );

        // Crea info oggetto
        let token_info = WaterTokenInfo {
            id: object::new(ctx),
            name: string::utf8(b"Water Credit Token"),
            symbol: string::utf8(b"WATER"),
            description: string::utf8(b"1 WATER = 1 litro d'acqua risparmiato rispetto alla media industriale"),
            total_minted: 0,
            total_burned: 0
        };

        // Condividi metadata
        transfer::public_freeze_object(metadata);
        
        // Condividi info
        transfer::share_object(token_info);
        
        // Treasury al deployer
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
    }

    // ============ FUNZIONI PUBBLICHE ============

    /// Minta nuovi token (solo treasury owner)
    public entry fun mint(
        treasury_cap: &mut TreasuryCap<WATER_TOKEN>,
        token_info: &mut WaterTokenInfo,
        amount: u64,
        recipient: address,
        reason: vector<u8>,
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(treasury_cap, amount, ctx);
        token_info.total_minted = token_info.total_minted + amount;

        event::emit(TokensMinted {
            amount,
            recipient,
            reason: string::utf8(reason)
        });

        transfer::public_transfer(coin, recipient);
    }

    /// Brucia token
    public entry fun burn(
        treasury_cap: &mut TreasuryCap<WATER_TOKEN>,
        token_info: &mut WaterTokenInfo,
        coin: Coin<WATER_TOKEN>,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&coin);
        token_info.total_burned = token_info.total_burned + amount;

        event::emit(TokensBurned {
            amount,
            burner: tx_context::sender(ctx)
        });

        coin::burn(treasury_cap, coin);
    }

    // ============ VIEW FUNCTIONS ============

    public fun get_token_stats(info: &WaterTokenInfo): (u64, u64) {
        (info.total_minted, info.total_burned)
    }

    public fun get_circulating_supply(info: &WaterTokenInfo): u64 {
        info.total_minted - info.total_burned
    }
}
