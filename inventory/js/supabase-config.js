// Konfigurasi untuk koneksi Supabase
const supabaseUrl = 'https://ndmwhoagrdcndybnjilw.supabase.co';
const supabaseKey = 'sb_publishable_M0cRLsz1mAGSWsvMTTMfHA_fbZI5-Rl';
// PERBAIKAN: Menggunakan createClient dari objek global supabase
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);