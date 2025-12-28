
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface KnowledgeItem {
    id: number;
    content: string;
}

interface KnowledgeBaseTabProps {
    urlInput: string;
    setUrlInput: (val: string) => void;
    handleScrape: () => void;
    isScraping: boolean;
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    knowledgeInput: string;
    setKnowledgeInput: (val: string) => void;
    addKnowledge: () => void;
    isEmbedding: boolean;
    knowledgeItems: KnowledgeItem[];
}

export const KnowledgeBaseTab: React.FC<KnowledgeBaseTabProps> = ({
    urlInput,
    setUrlInput,
    handleScrape,
    isScraping,
    fileInputRef,
    handleFileUpload,
    knowledgeInput,
    setKnowledgeInput,
    addKnowledge,
    isEmbedding,
    knowledgeItems
}) => {
    return (
        <div className="flex-1 overflow-y-auto p-6 m-0 h-full scrollbar-thin scrollbar-thumb-slate-200">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Knowledge Base</h2>
                        <p className="text-sm text-slate-500">Add documents or website content to train your AI agent.</p>
                    </div>
                </div>
                
                <Card className="border border-slate-200 bg-white text-slate-900 shadow-sm">
                    <CardHeader><CardTitle className="text-sm font-semibold">Add New Knowledge</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        {/* Import Sources Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                            <div className="flex gap-2 items-center">
                                <Input 
                                    placeholder="https://example.com/property" 
                                    value={urlInput} 
                                    onChange={(e) => setUrlInput(e.target.value)} 
                                    className="bg-slate-50 border-slate-300 h-10 text-slate-900" 
                                />
                                <Button 
                                    variant="outline" 
                                    onClick={handleScrape} 
                                    disabled={isScraping || !urlInput}
                                    className="border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                >
                                    {isScraping ? 'Scraping...' : 'Import URL'}
                                </Button>
                            </div>
                            <div className="flex justify-end gap-2 items-center">
                                <span className="text-xs text-slate-500">or upload file:</span>
                                <Input 
                                    type="file" 
                                    className="hidden" 
                                    ref={fileInputRef} 
                                    onChange={handleFileUpload} 
                                    accept=".txt,.md,.csv,.json,.pdf,.docx" 
                                />
                                <Button 
                                    variant="outline" 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                >
                                    Upload File (PDF/Text)
                                </Button>
                            </div>
                        </div>

                        {/* Content Editor */}
                        <textarea 
                            value={knowledgeInput} 
                            onChange={(e) => setKnowledgeInput(e.target.value)} 
                            className="w-full h-48 bg-slate-50 border border-slate-300 rounded-md p-3 text-sm focus:ring-1 focus:ring-blue-500 font-mono leading-relaxed text-slate-900 placeholder:text-slate-400" 
                            placeholder="Content from files or URLs will appear here for review before saving..." 
                        />
                        
                        <div className="flex justify-between items-center pt-2">
                            <p className="text-xs text-slate-500">Content is converted to vectors using OpenAI Embeddings.</p>
                            <Button onClick={addKnowledge} disabled={isEmbedding || !knowledgeInput.trim()} className="bg-blue-600 hover:bg-blue-500 px-6 text-white">
                                {isEmbedding ? 'Vectorizing...' : 'Save to Knowledge Base'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {knowledgeItems.map((item) => (
                        <Card key={item.id} className="border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all">
                            <CardContent className="p-4">
                                <p className="text-xs text-slate-600 line-clamp-4 leading-relaxed">{item.content}</p>
                                <div className="mt-3 flex justify-between items-center text-[10px] text-slate-400"><span>ID: {item.id}</span><Badge variant="outline" className="border-slate-200 text-slate-500">Chunk</Badge></div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
};
