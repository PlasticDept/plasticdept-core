// Data struktur lokasi
const locations = [
    "DA-01-2-4", "DA-02-1-4", "DA-02-2-4", "DA-03-1-2", "DA-03-1-4", "DA-03-2-2", "DA-04-1-2", "DA-04-2-2", 
    "DA-06-1-4", "DA-07-2-4", "DA-08-2-2", "DA-09-1-4", "DA-09-2-4", "DA-11-1-2", "DA-11-2-4", "DA-12-2-2", 
    "DA-12-2-4", "DA-13-1-1", "DA-13-2-1", "DA-13-2-2", "DB-01-2-2", "DB-02-1-3", "DB-02-2-2", "DB-03-1-3", 
    "DB-03-2-2", "DB-03-2-4", "DB-04-1-4", "DB-05-1-2", "DB-05-2-3", "DB-06-1-4", "DB-06-2-4", "DB-07-1-2", 
    "DB-07-2-3", "DB-07-2-4", "DB-08-1-4", "DB-08-2-4", "DB-09-1-2", "DB-10-1-2", "DB-11-2-2", "DB-12-1-4", 
    "DB-12-2-2", "DB-13-1-3", "DB-13-2-2", "DB-13-2-4", "DC-01-1-2", "DC-01-1-3", "DC-01-1-4", "DC-01-2-3", 
    "DC-01-2-4", "DC-02-1-2", "DC-02-2-2", "DC-02-2-4", "DC-03-1-2", "DC-03-1-4", "DC-03-2-2", "DC-03-2-4", 
    "DC-04-1-2", "DC-04-1-3", "DC-04-1-4", "DC-05-1-3", "DC-05-1-4", "DC-05-2-2", "DC-05-2-3", "DC-05-2-4", 
    "DC-06-1-2", "DC-06-1-4", "DC-06-2-2", "DC-06-2-4", "DC-07-1-2", "DC-07-1-4", "DC-07-2-2", "DC-07-2-4", 
    "DC-08-1-2", "DC-08-2-2", "DC-08-2-3", "DC-09-1-2", "DC-09-1-4", "DC-10-1-4", "DC-10-2-2", "DC-11-2-2", 
    "DC-11-2-4", "DC-12-1-2", "DC-12-1-4", "DC-12-2-2", "DC-12-2-4", "DC-13-1-4", "DC-13-2-2", "DC-14-1-2", 
    "DC-14-1-4", "DC-14-2-2", "DC-14-2-4", "DC-15-1-2", "DC-15-1-4", "DD-01-1-2", "DD-01-1-4", "DD-01-2-1", 
    "DD-01-2-2", "DD-01-2-3", "DD-01-2-4", "DD-02-1-1", "DD-02-1-2", "DD-02-1-4", "DD-02-2-1", "DD-02-2-2", 
    "DD-02-2-4", "DD-03-1-1", "DD-03-1-2", "DD-03-1-3", "DD-03-1-4", "DD-03-2-1", "DD-03-2-2", "DD-03-2-3", 
    "DD-03-2-4", "DD-04-1-1", "DD-04-1-2", "DD-04-1-3", "DD-04-1-4", "DD-04-2-1", "DD-04-2-3", "DD-04-2-4", 
    "DD-05-1-1", "DD-05-1-2", "DD-05-1-3", "DD-05-1-4", "DD-05-2-1", "DD-05-2-2", "DD-05-2-3", "DD-05-2-4", 
    "DD-06-1-1", "DD-06-1-2", "DD-06-1-4", "DD-06-2-1", "DD-06-2-2", "DD-06-2-4", "DD-07-1-1", "DD-07-1-2", 
    "DD-07-1-3", "DD-07-1-4", "DD-07-2-1", "DD-07-2-2", "DD-07-2-4", "DD-08-1-1", "DD-08-1-2", "DD-08-1-3", 
    "DD-08-1-4", "DD-08-2-2", "DD-08-2-3", "DD-08-2-4", "DD-09-1-2", "DD-09-1-3", "DD-09-1-4", "DD-09-2-1", 
    "DD-09-2-2", "DD-09-2-3", "DD-09-2-4", "DD-10-1-1", "DD-10-1-2", "DD-10-1-4", "DD-10-2-2", "DD-10-2-3", 
    "DD-10-2-4", "DD-11-1-1", "DD-11-1-2", "DD-11-1-3", "DD-11-1-4", "DD-11-2-1", "DD-11-2-2", "DD-11-2-3", 
    "DD-11-2-4", "DD-12-1-1", "DD-12-1-2", "DD-12-1-3", "DD-12-1-4", "DD-12-2-1", "DD-12-2-2", "DD-12-2-3", 
    "DD-12-2-4", "DD-13-1-1", "DD-13-1-2", "DD-13-1-3", "DD-13-1-4", "DD-13-2-2", "DD-13-2-4", "DD-14-1-1", 
    "DD-14-1-2", "DD-14-1-4", "DD-14-2-1", "DD-14-2-2", "DD-14-2-4", "DD-15-1-1", "DD-15-1-2", "DD-15-1-4", 
    "DD-15-2-1", "DD-15-2-2", "DD-15-2-3", "DD-15-2-4", "DE-01-1-1", "DE-01-1-2", "DE-01-1-3", "DE-01-1-4", 
    "DE-01-2-1", "DE-01-2-2", "DE-01-2-3", "DE-01-2-4", "DE-02-1-1", "DE-02-1-2", "DE-02-1-3", "DE-02-1-4", 
    "DE-02-2-1", "DE-02-2-2", "DE-02-2-3", "DE-02-2-4", "DE-03-1-1", "DE-03-1-2", "DE-03-1-3", "DE-03-1-4", 
    "DE-03-2-2", "DE-03-2-3", "DE-03-2-4", "DE-04-1-1", "DE-04-1-2", "DE-04-1-3", "DE-04-1-4", "DE-04-2-1", 
    "DE-04-2-2", "DE-04-2-3", "DE-04-2-4", "DE-05-1-1", "DE-05-1-2", "DE-05-1-3", "DE-05-1-4", "DE-05-2-1", 
    "DE-05-2-2", "DE-05-2-3", "DE-05-2-4", "DE-06-1-1", "DE-06-1-2", "DE-06-1-3", "DE-06-1-4", "DE-06-2-1", 
    "DE-06-2-2", "DE-06-2-3", "DE-06-2-4", "DE-07-1-1", "DE-07-1-2", "DE-07-1-3", "DE-07-1-4", "DE-07-2-1", 
    "DE-07-2-2", "DE-07-2-3", "DE-08-2-1", "DE-09-1-1", "DE-09-1-2", "DE-09-1-3", "DE-09-1-4", "DE-09-2-1", 
    "DE-09-2-2", "DE-09-2-4", "DE-10-1-1", "DE-10-1-2", "DE-10-1-3", "DE-10-1-4", "DE-10-2-1", "DE-10-2-2", 
    "DE-10-2-3", "DE-10-2-4", "DE-11-1-1", "DE-11-1-2", "DE-11-1-3", "DE-11-1-4", "DE-11-2-2", "DE-11-2-3", 
    "DE-11-2-4", "DE-12-1-2", "DE-12-1-3", "DE-12-1-4", "DE-12-2-2", "DE-12-2-3", "DE-12-2-4", "DE-13-1-1", 
    "DE-13-1-2", "DE-13-1-3", "DE-13-1-4", "DE-13-2-1", "DE-13-2-2", "DE-13-2-3", "DE-13-2-4", "DE-14-1-1", 
    "DE-14-1-2", "DE-14-1-3", "DE-14-1-4", "DE-14-2-1", "DE-14-2-2", "DE-14-2-3", "DE-14-2-4", "DE-15-1-1", 
    "DE-15-1-2", "DE-15-1-3", "DE-15-1-4", "DE-15-2-1", "DE-15-2-2", "DE-15-2-4"
];

// Inisialisasi data acak untuk occupancy
const occupancyData = {};

// Daftar customer
const customers = ["ABC", "DEF", "GHI", "JKL"];
const materials = {
    "ABC": [
        "Raw Material Plastic A", "Raw Material Plastic B", "Plastic Pellets", 
        "HDPE Compound", "LDPE Compound", "PP Compound", "PVC Compound", 
        "Color Masterbatch", "Additives", "Plastic Fillers"
    ],
    "DEF": [
        "Injection Mold Tools", "Blow Mold Tools", "Compression Mold Tools", 
        "Packaging Materials", "PP Sheets", "PE Sheets", "Plastic Trays", 
        "Labels", "Plastic Containers", "Bottle Preforms"
    ],
    "GHI": [
        "Recycled Plastic Flakes", "Recycled Plastic Pellets", "Bio-based Plastics", 
        "Biodegradable Compounds", "Plastic Regrinds", "Plastic Scrap", 
        "Plastic Parts", "Plastic Components", "Molded Products", "Finished Goods"
    ],
    "JKL": [
        "Testing Materials", "QC Samples", "Plastic Film Rolls", "Packaging Films", 
        "Polymer Blends", "Custom Compounds", "Specialty Plastics", 
        "Engineering Plastics", "Plastic Sheets", "Plastic Profiles"
    ]
};

// Buat data occupancy acak (60% terisi, 40% kosong)
locations.forEach(location => {
    if (Math.random() < 0.6) {
        // Lokasi terisi
        const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
        const customerMaterials = materials[randomCustomer];
        const randomMaterial = customerMaterials[Math.floor(Math.random() * customerMaterials.length)];
        const randomQuantity = `${Math.floor(Math.random() * 900) + 100} ${Math.random() < 0.5 ? 'kg' : 'pcs'}`;
        
        // Buat tanggal acak dalam 2 minggu terakhir
        const now = new Date('2025-07-11');
        const randomDaysAgo = Math.floor(Math.random() * 14);
        const date = new Date(now);
        date.setDate(now.getDate() - randomDaysAgo);
        const dateString = date.toISOString().split('T')[0];
        
        occupancyData[location] = {
            status: "occupied",
            customer: randomCustomer,
            material: randomMaterial,
            quantity: randomQuantity,
            dateIn: dateString
        };
    } else {
        // Lokasi kosong
        occupancyData[location] = {
            status: "empty"
        };
    }
});

// Konfigurasi customer dan warna
const customerColors = {
    "ABC": "customer-abc",
    "DEF": "customer-def",
    "GHI": "customer-ghi",
    "JKL": "customer-jkl"
};