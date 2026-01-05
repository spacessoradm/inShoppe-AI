
import { supabase } from './supabase';

export type DocumentType = 'SPA' | 'Invoice' | 'Quotation' | 'BookingForm';

// --- STRUCTURED DATA SCHEMA ---
export interface DocumentData {
    buyer?: {
        name?: string;
        id_number?: string;
        phone?: string;
        email?: string;
        address?: string;
    };
    property?: {
        id?: string;
        address?: string;
        price?: string;
        type?: string;
    };
    transaction?: {
        deposit_amount?: string;
        payment_terms?: string;
        booking_date?: string;
        total_price?: string;
    };
    agent?: {
        name?: string;
        organization?: string;
        license_no?: string;
    };
    [key: string]: any;
}

// --- AI EXTRACTION LOGIC ---
const buildExtractionPrompt = (documentType: DocumentType, chatHistory: any[], existingLeadData?: any): string => {
    return `
    You are a Legal Document Assistant.
    Your goal is to extract specific information from a chat history to fill a "${documentType}" document.
    
    CRITICAL RULES:
    1. Only extract information that is explicitly confirmed or mentioned in the chat.
    2. If a field is missing, leave it as null or empty string. DO NOT HALLUCINATE.
    3. Use the "Existing Lead Data" as a fallback/context if available.
    
    EXISTING LEAD DATA:
    ${JSON.stringify(existingLeadData || {})}

    CHAT HISTORY:
    ${JSON.stringify(chatHistory)}

    REQUIRED OUTPUT STRUCTURE (JSON):
    {
      "buyer": {
        "name": "Full Name",
        "id_number": "NRIC or Passport",
        "phone": "Phone Number",
        "email": "Email Address",
        "address": "Mailing Address"
      },
      "property": {
        "address": "Full Property Address / Unit Number",
        "price": "Total Purchase Price (Numeric String)",
        "type": "Condo / Landed / etc"
      },
      "transaction": {
        "deposit_amount": "Deposit Paid",
        "booking_date": "Date of Booking (ISO)"
      },
      "missing_fields": ["List of critical fields that are null"]
    }
    `;
};

// --- API CALL ---
export const extractDocumentData = async (
    chatHistory: { role: string; content: string }[],
    documentType: DocumentType,
    existingLeadData?: any,
    apiKey?: string
): Promise<DocumentData & { missing_fields?: string[] }> => {
    if (!supabase) throw new Error("Supabase not initialized");

    const prompt = buildExtractionPrompt(documentType, chatHistory, existingLeadData);

    const { data, error } = await supabase.functions.invoke('openai-proxy', {
        body: {
            action: 'chat',
            apiKey,
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: prompt }],
            temperature: 0.1, // Very low temp for extraction
            response_format: { type: "json_object" }
        }
    });

    if (error) {
        console.error("Extraction Error:", error);
        throw new Error(error.message);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content returned from AI");

    return JSON.parse(content);
};

// --- GENERATION ORCHESTRATOR ---
export const generateDocument = async (
    templateId: string, 
    documentData: DocumentData, 
    leadId: number, 
    organizationId: string
) => {
    if (!supabase) throw new Error("Supabase not initialized");

    // 1. Create a record in generated_documents (Status: Processing)
    const { data: docRecord, error: dbError } = await supabase
        .from('generated_documents')
        .insert({
            organization_id: organizationId,
            lead_id: leadId,
            template_id: templateId,
            status: 'processing',
            metadata: documentData
        })
        .select()
        .single();

    if (dbError) throw dbError;

    try {
        // 2. Call Edge Function to Generate DOCX
        // Note: We expect the Edge Function to handle template fetching, filling, and uploading back to storage.
        const { data: genResult, error: fnError } = await supabase.functions.invoke('generate-document', {
            body: {
                record_id: docRecord.id,
                template_id: templateId,
                data: documentData
            }
        });

        if (fnError) throw fnError;

        // 3. Update record with result (Handled by Edge Function usually, but we can double check)
        return { success: true, documentId: docRecord.id, url: genResult?.url };

    } catch (e: any) {
        // Mark as failed
        await supabase.from('generated_documents').update({ status: 'failed' }).eq('id', docRecord.id);
        throw e;
    }
};

// --- MOCK GENERATOR (For Demo without Edge Function) ---
export const mockGenerateDocument = async (
    templateType: string,
    documentData: DocumentData,
    leadId: number,
    organizationId: string
) => {
    if (!supabase) throw new Error("Supabase not initialized");

    // 1. Create Placeholder Record
    const { data: docRecord, error } = await supabase
        .from('generated_documents')
        .insert({
            organization_id: organizationId,
            lead_id: leadId,
            template_id: '00000000-0000-0000-0000-000000000000', // Dummy ID
            status: 'processing',
            metadata: documentData
        })
        .select()
        .single();
        
    if (error) throw error;

    // 2. Simulate Delay
    await new Promise(r => setTimeout(r, 2000));

    // 3. "Generate" (Just return a dummy link)
    const mockUrl = `https://example.com/documents/SPA_${documentData.buyer?.name?.replace(/\s+/g, '_') || 'Draft'}.docx`;
    
    await supabase
        .from('generated_documents')
        .update({ 
            status: 'generated',
            file_url: mockUrl 
        })
        .eq('id', docRecord.id);

    return { success: true, documentId: docRecord.id, url: mockUrl };
};
