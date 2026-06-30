import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testing Supabase storage upload...');
  const fileContent = fs.readFileSync('index.html');
  const { data, error } = await supabase.storage
    .from('images')
    .upload('test.html', fileContent);
  
  if (error) {
    console.error('Storage error:', error);
  } else {
    console.log('Storage successful:', data);
  }
}

test();
