// Data occupancy area dan high rack
const occupancyData = {
    // Area A
    "A1": { 
        status: "occupied", 
        customer: "ABC", 
        material: "Bahan Baku Plastik", 
        quantity: "500 kg", 
        dateIn: "2025-07-05" 
    },
    "A2": { 
        status: "occupied", 
        customer: "DEF", 
        material: "Komponen Elektronik", 
        quantity: "200 unit", 
        dateIn: "2025-07-08" 
    },
    "A3": { 
        status: "empty" 
    },
    "A4": { 
        status: "occupied", 
        customer: "ABC", 
        material: "Kemasan Produk", 
        quantity: "1000 pcs", 
        dateIn: "2025-07-02" 
    },
    "A5": { 
        status: "occupied", 
        customer: "GHI", 
        material: "Sparepart Mesin", 
        quantity: "50 set", 
        dateIn: "2025-07-10" 
    },
    "A6": { 
        status: "empty" 
    },
    "A7": { 
        status: "occupied", 
        customer: "DEF", 
        material: "PCB Assembly", 
        quantity: "300 unit", 
        dateIn: "2025-07-03" 
    },
    "A8": { 
        status: "occupied", 
        customer: "ABC", 
        material: "Label Produk", 
        quantity: "2000 pcs", 
        dateIn: "2025-07-09" 
    },
    "A9": { 
        status: "empty" 
    },
    "A10": { 
        status: "occupied", 
        customer: "GHI", 
        material: "Komponen Mekanik", 
        quantity: "150 unit", 
        dateIn: "2025-07-01" 
    },
    
    // Lanjutkan dengan data untuk A11-A20
    "A11": { status: "empty" },
    "A12": { 
        status: "occupied", 
        customer: "ABC", 
        material: "Box Packaging", 
        quantity: "300 pcs", 
        dateIn: "2025-07-06" 
    },
    "A13": { 
        status: "occupied", 
        customer: "DEF", 
        material: "Cable Assembly", 
        quantity: "100 set", 
        dateIn: "2025-07-05" 
    },
    "A14": { status: "empty" },
    "A15": { 
        status: "occupied", 
        customer: "GHI", 
        material: "Metal Parts", 
        quantity: "250 kg", 
        dateIn: "2025-07-04" 
    },
    "A16": { 
        status: "occupied", 
        customer: "ABC", 
        material: "Plastic Components", 
        quantity: "450 pcs", 
        dateIn: "2025-07-09" 
    },
    "A17": { status: "empty" },
    "A18": { 
        status: "occupied", 
        customer: "DEF", 
        material: "LCD Modules", 
        quantity: "75 units", 
        dateIn: "2025-07-07" 
    },
    "A19": { 
        status: "occupied", 
        customer: "GHI", 
        material: "Rubber Seals", 
        quantity: "1000 pcs", 
        dateIn: "2025-07-08" 
    },
    "A20": { status: "empty" },
    
    // Area B
    "B1": { 
        status: "occupied", 
        customer: "DEF", 
        material: "Power Supply Units", 
        quantity: "100 units", 
        dateIn: "2025-07-06" 
    },
    "B2": { status: "empty" },
    "B3": { 
        status: "occupied", 
        customer: "ABC", 
        material: "Plastic Housing", 
        quantity: "350 pcs", 
        dateIn: "2025-07-03" 
    },
    "B4": { 
        status: "occupied", 
        customer: "GHI", 
        material: "Bearing Assembly", 
        quantity: "200 sets", 
        dateIn: "2025-07-10" 
    },
    "B5": { 
        status: "occupied", 
        customer: "DEF", 
        material: "Sensor Modules", 
        quantity: "150 units", 
        dateIn: "2025-07-01" 
    },
    "B6": { status: "empty" },
    "B7": { 
        status: "occupied", 
        customer: "ABC", 
        material: "Plastic Resin", 
        quantity: "600 kg", 
        dateIn: "2025-07-09" 
    },
    "B8": { 
        status: "occupied", 
        customer: "GHI", 
        material: "Aluminum Parts", 
        quantity: "300 kg", 
        dateIn: "2025-07-04" 
    },
    "B9": { status: "empty" },
    "B10": { 
        status: "occupied", 
        customer: "DEF", 
        material: "Battery Packs", 
        quantity: "120 units", 
        dateIn: "2025-07-05" 
    },
    
    // Lanjutkan dengan data untuk B11-B20
    "B11": { 
        status: "occupied", 
        customer: "ABC", 
        material: "Adhesive Tape", 
        quantity: "400 rolls", 
        dateIn: "2025-07-02" 
    },
    "B12": { status: "empty" },
    "B13": { 
        status: "occupied", 
        customer: "GHI", 
        material: "Fasteners", 
        quantity: "5000 pcs", 
        dateIn: "2025-07-07" 
    },
    "B14": { 
        status: "occupied", 
        customer: "DEF", 
        material: "Circuit Boards", 
        quantity: "250 pcs", 
        dateIn: "2025-07-08" 
    },
    "B15": { status: "empty" },
    "B16": { 
        status: "occupied", 
        customer: "ABC", 
        material: "Color Pigments", 
        quantity: "100 kg", 
        dateIn: "2025-07-09" 
    },
    "B17": { 
        status: "occupied", 
        customer: "GHI", 
        material: "Steel Frames", 
        quantity: "80 units", 
        dateIn: "2025-07-10" 
    },
    "B18": { status: "empty" },
    "B19": { 
        status: "occupied", 
        customer: "DEF", 
        material: "RFID Tags", 
        quantity: "1500 pcs", 
        dateIn: "2025-07-01" 
    },
    "B20": { 
        status: "occupied", 
        customer: "ABC", 
        material: "Injection Molds", 
        quantity: "10 sets", 
        dateIn: "2025-07-04" 
    }
};

// Konfigurasi customer dan warna
const customerColors = {
    "ABC": "customer-abc",
    "DEF": "customer-def",
    "GHI": "customer-ghi"
};