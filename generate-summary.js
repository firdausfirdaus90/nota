// api/generate-summary.js - Vercel serverless function
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    try {
        const { patientData, apiKey } = req.body;

        // Validate required fields
        if (!patientData || !apiKey) {
            return res.status(400).json({ 
                error: 'Missing required fields: patientData and apiKey' 
            });
        }

        if (!apiKey.startsWith('sk-ant-')) {
            return res.status(400).json({ 
                error: 'Invalid API key format. Must start with sk-ant-' 
            });
        }

        // Construct the prompt
        const prompt = `Based on the following patient information and clinical notes, generate a comprehensive discharge summary in standard medical format. Include sections for: Hospital Course, Discharge Diagnosis, Medications, Follow-up Instructions, and Patient Education. Make it professional and concise.

Patient: ${patientData.name}
Age: ${patientData.age}
MRN: ${patientData.mrn}
Admission Date: ${patientData.admission}
Primary Diagnosis: ${patientData.diagnosis}

Clinical Notes:
${patientData.notes.map(note => 
    `${note.date} ${note.time} - ${note.type}:\n${note.content}`
).join('\n\n')}

Generate a properly formatted discharge summary:`;

        // Call Claude API
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 2000,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Claude API Error:', response.status, errorText);
            
            let errorMessage = 'Claude API request failed';
            if (response.status === 401) {
                errorMessage = 'Invalid API key. Please check your Claude API key.';
            } else if (response.status === 429) {
                errorMessage = 'Rate limit exceeded. Please try again later.';
            } else if (response.status === 402) {
                errorMessage = 'Insufficient credits. Please add more credits to your Anthropic account.';
            }
            
            return res.status(response.status).json({ 
                error: errorMessage,
                details: errorText 
            });
        }

        const data = await response.json();
        const summary = data.content[0].text;

        res.json({ 
            summary: summary,
            usage: data.usage || null
        });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}
