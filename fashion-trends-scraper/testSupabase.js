// Test Supabase Connection
const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

async function testSupabase() {
    const supabase = createClient(config.supabase.url, config.supabase.anonKey);
    
    console.log('Testing Supabase connection...\n');
    
    // Try to read from the trends table
    const { data: readData, error: readError } = await supabase
        .from('trends')
        .select('*')
        .limit(1);
    
    if (readError) {
        console.log('Error reading from trends table:', readError);
    } else {
        console.log('Successfully read from trends table');
        console.log('Existing rows:', readData?.length || 0);
    }
    
    // Try to insert a test trend
    const testTrend = {
        trend_identifier: 'test-trend-' + Date.now(),
        trend_category: 'style',
        momentum_score: 75.5,
        velocity: 12.3,
        lifecycle_stage: 'emerging',
        adoption_rate: 0.25,
        demographic_segments: {
            ageGroups: ['25-34'],
            gender: ['unisex'],
            location: ['global'],
            incomeLevel: ['medium']
        },
        competitor_adoption: 0.15,
        seasonality_factor: 0.8,
        predicted_peak_date: '2025-08-01',
        predicted_decline_date: '2026-01-01',
        social_reach: 100000,
        conversion_impact: 0.5,
        risk_score: 0.6,
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString()
    };
    
    const { data: insertData, error: insertError } = await supabase
        .from('trends')
        .insert([testTrend])
        .select();
    
    if (insertError) {
        console.log('\nError inserting test trend:', insertError);
        console.log('\n⚠️  Row Level Security (RLS) is enabled on your trends table.');
        console.log('\nTo fix this, you have two options:\n');
        console.log('Option 1: Disable RLS temporarily (for testing):');
        console.log('1. Go to your Supabase dashboard');
        console.log('2. Navigate to Authentication > Policies');
        console.log('3. Find the "trends" table');
        console.log('4. Disable RLS or create a policy that allows INSERT operations\n');
        console.log('Option 2: Create an RLS policy:');
        console.log('1. In Supabase SQL Editor, run this command:');
        console.log(`
CREATE POLICY "Allow anonymous inserts" ON public.trends
FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "Allow anonymous reads" ON public.trends
FOR SELECT TO anon
USING (true);
        `);
    } else {
        console.log('\n✅ Successfully inserted test trend!');
        console.log('Inserted data:', insertData);
    }
}

testSupabase(); 