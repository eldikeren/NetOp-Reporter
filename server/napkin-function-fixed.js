import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    if (!(await base44.auth.isAuthenticated())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const { prompt, diagramType, orientation, detail } = await req.json();

        // ✅ FIXED: Correct environment variable access
        const apiKey = Deno.env.get("NAPKIN_API_KEY") || "sk-d4c4e37aa968c8df99eb41617d03a0cf7a4f1521f4f2184f1c18741d00c9ec64";

        if (!apiKey) {
             return new Response(JSON.stringify({ 
                success: false, 
                error: "Napkin API key is not configured." 
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const headers = {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        };

        // ✅ FIXED: Correct Napkin API request structure
        const body = {
            content: prompt,
            style: diagramType || "professional",
            format: "png",
            language: "en-US"
        };
        
        console.log('🎨 Creating Napkin visualization...');
        
        // Step 1: Create visualization request
        const response = await fetch("https://api.napkin.ai/v1/visual", {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Napkin API Error:', response.status, errorText);
            
            // ✅ FIXED: Handle specific error codes
            if (response.status === 403) {
                throw new Error('Napkin API authentication failed - check your API key');
            } else if (response.status === 429) {
                throw new Error('Napkin API rate limit exceeded - try again later');
            } else if (response.status === 404) {
                throw new Error('Napkin API endpoint not found');
            } else {
                throw new Error(`Napkin API Error: ${response.status} ${errorText}`);
            }
        }

        const responseData = await response.json();
        const requestId = responseData.id;
        console.log('✅ Visualization request created:', requestId);

        // Step 2: Poll for completion with proper error handling
        let targetFile = null;
        const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds
        let attempts = 0;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
            attempts++;

            try {
                const statusResponse = await fetch(`https://api.napkin.ai/v1/visual/${requestId}/status`, {
                    method: "GET",
                    headers: headers
                });

                if (!statusResponse.ok) {
                    const errorText = await statusResponse.text();
                    throw new Error(`Status check failed: ${statusResponse.status} ${errorText}`);
                }

                const statusData = await statusResponse.json();
                const { status, generated_files } = statusData;

                if (status === 'completed' && generated_files && generated_files.length > 0) {
                    targetFile = generated_files[0]; // Use the first generated file
                    console.log('✅ Visualization completed');
                    break;
                } else if (status === 'failed') {
                    throw new Error('Visualization generation failed');
                }

                console.log(`⏳ Status: ${status} (attempt ${attempts}/${maxAttempts})`);
            } catch (error) {
                if (error.message.includes('429')) {
                    console.log('⚠️ Rate limited, waiting...');
                    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                } else {
                    throw error;
                }
            }
        }

        if (!targetFile) {
            throw new Error('Visualization generation timed out');
        }

        // Step 3: Download the file with proper error handling
        let imageResponse;
        try {
            imageResponse = await fetch(targetFile.url, { 
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`
                }
            });
        } catch (downloadError) {
            // Fallback: try without authorization header
            imageResponse = await fetch(targetFile.url, {
                method: "GET"
            });
        }

        if (!imageResponse.ok) {
            throw new Error(`Failed to download image: ${imageResponse.status}`);
        }

        // Convert response to blob/file
        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
        
        // Create a File object for upload
        const fileName = `visual-${Date.now()}.png`;
        const imageFile = new File([imageBlob], fileName, { type: 'image/png' });

        // Upload to Base44 file system
        const uploadResult = await base44.integrations.Core.UploadFile({ file: imageFile });
        const publicImageUrl = uploadResult.file_url;
        
        console.log(`✅ Generated and uploaded image: ${publicImageUrl}`);
        
        return new Response(JSON.stringify({ 
            success: true, 
            imageUrl: publicImageUrl, 
            napkinId: requestId
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Napkin function error:", error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});
