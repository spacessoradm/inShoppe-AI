
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/Accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { supabase } from '../services/supabase';

const ACCENT_COLOR = '#4A5D23'; 
const ACCENT_GLOW = 'rgba(74, 93, 35, 0.4)';

const faqData = [
  {
    question: "What AI model does the system use?",
    answer: "We use a hybrid AI engine powered by GPT-5 and optimized open-source models such as Llama and Qwen. This allows the system to deliver high-accuracy responses while keeping performance fast and cost-efficient."
  },
  {
    question: "How do you ensure the AI gives accurate answers?",
    answer: "Our system uses a combination of RAG (Retrieval-Augmented Generation) to pull answers from your private knowledge base, custom prompt rules to reduce AI mistakes, and continuous training based on your feedback. This ensures responses stay correct, consistent, and aligned with your business."
  },
  {
    question: "Is my data safe?",
    answer: "Yes. All data is encrypted using industry-standard AES-256 and SSL/HTTPS. Your content is never used to train public models, and your information remains fully confidential according to GDPR/PDPA-compliant policies."
  },
  {
    question: "Does the AI store customer messages?",
    answer: "Only if you enable history or analytics. You have full control to turn off message logging, delete conversations, and restrict access via role-based permissions (RBAC)."
  },
  {
    question: "Do you use any third-party platforms?",
    answer: "Yes, but only secure, enterprise-grade providers such as OpenAI, Anthropic, Qwen, Supabase, Pinecone (for database & vector search), and Cloudflare/AWS (for hosting & security). These platforms follow strict compliance and privacy standards."
  },
  {
    question: "How do I update the AI with new information?",
    answer: "You can upload documents, add text, or sync your website. The knowledge base updates in real time, and the AI will immediately use the newest info to reply accurately."
  },
  {
    question: "Can I customize the answers or tone of the AI?",
    answer: "Absolutely. You can set the tone (formal, friendly, professional), response length, allowed or restricted topics, and company style guidelines. This makes the AI match your brand image."
  },
  {
    question: "What if the AI gives a wrong answer?",
    answer: "You can correct it directly in the dashboard. The system will learn from your correction, update the knowledge base, and improve accuracy over time. This is part of our built-in feedback optimization loop."
  },
  {
    question: "Do you offer long-term support?",
    answer: "Yes. All plans include technical support, bug fixes, system monitoring, and free improvements and optimization updates. Premium plans include priority support and SLA guarantees."
  },
  {
    question: "Can the AI integrate with my existing system?",
    answer: "Yes. We support API integrations, webhook automations, CRM/ERP connections, and WhatsApp, Telegram, Messenger, and Email automations. If you need customized integration, we can build it for you."
  }
];

// --- Animation: Solving Chaos (Light Theme) ---
const SolvingAnimation: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = container.offsetWidth;
    let height = container.offsetHeight;

    const resize = () => {
      width = container.offsetWidth;
      height = container.offsetHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', resize);
    resize();

    const GOLD = ACCENT_COLOR;
    const BUBBLE_WIDTH = 260;
    const BUBBLE_HEIGHT = 56;
    
    const bubbles = Array.from({ length: 7 }).map((_, i) => ({
      id: i,
      cx: Math.random() * (width * 0.6) + width * 0.2,
      cy: Math.random() * (height * 0.6) + height * 0.2,
      ox: width / 2 - BUBBLE_WIDTH / 2, 
      oy: 60 + i * (BUBBLE_HEIGHT + 16),
      isAi: i === 2, 
      tag: i % 2 === 0 ? 'High Intent' : 'Inquiry',
      driftOffset: Math.random() * 100,
      driftSpeed: 0.5 + Math.random() * 0.5,
    }));

    const particles = Array.from({ length: 30 }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2,
      speedX: (Math.random() - 0.5) * 0.5,
      speedY: (Math.random() - 0.5) * 0.5,
      opacity: Math.random() * 0.5
    }));

    let startTime = performance.now();
    const cycleDuration = 12000; 

    const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const render = (time: number) => {
      const elapsed = (time - startTime) % cycleDuration;
      let phase = 'chaos';
      let t = 0;

      if (elapsed < 4000) {
        phase = 'chaos';
        t = 0;
      } else if (elapsed < 5000) {
        phase = 'transition';
        t = (elapsed - 4000) / 1000;
      } else if (elapsed < 11000) {
        phase = 'order';
        t = 1;
      } else {
        phase = 'reset';
        t = 1 - (elapsed - 11000) / 1000;
      }

      const easeOutElastic = (x: number): number => {
        const c4 = (2 * Math.PI) / 3;
        return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
      };
      const smoothT = phase === 'transition' ? easeOutElastic(t) : t;

      ctx.clearRect(0, 0, width, height);

      // Particles (Light Gray)
      ctx.fillStyle = '#94a3b8'; // Slate-400
      particles.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
        ctx.globalAlpha = p.opacity * (phase === 'order' ? 0.2 : 0.5); 
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Bubbles
      bubbles.forEach((b, i) => {
        let x, y;
        if (phase === 'chaos' || phase === 'reset') {
          const floatX = Math.sin((time / 1000) * b.driftSpeed + b.driftOffset) * 20;
          const floatY = Math.cos((time / 1000) * b.driftSpeed + b.driftOffset) * 20;
          const interp = phase === 'reset' ? smoothT : 0;
          x = b.cx + floatX + (b.ox - b.cx) * interp;
          y = b.cy + floatY + (b.oy - b.cy) * interp;
        } else {
          x = b.cx + (b.ox - b.cx) * smoothT;
          y = b.cy + (b.oy - b.cy) * smoothT;
        }

        ctx.save();
        if (phase === 'order' || phase === 'transition') {
          // Ordered: White cards with shadow
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 4;
          
          if (b.isAi) {
            ctx.strokeStyle = GOLD;
            ctx.lineWidth = 2;
          } else {
            ctx.strokeStyle = '#e2e8f0'; // Slate-200
            ctx.lineWidth = 1;
          }
        } else {
          // Chaos: Light gray cards
          ctx.fillStyle = '#f8fafc'; // Slate-50
          ctx.strokeStyle = '#e2e8f0'; // Slate-200
          ctx.lineWidth = 1;
          ctx.shadowColor = 'transparent';
        }

        drawRoundedRect(x, y, BUBBLE_WIDTH, BUBBLE_HEIGHT, 12);
        ctx.fill();
        ctx.shadowBlur = 0; // Reset shadow for stroke and contents
        ctx.shadowOffsetY = 0;
        ctx.stroke();

        // Text Lines inside bubbles
        ctx.fillStyle = b.isAi ? GOLD : '#94a3b8'; // Slate-400
        const textOpacity = phase === 'order' ? 1 : 0.5;
        ctx.globalAlpha = textOpacity;
        ctx.fillRect(x + 16, y + 16, 100, 6);
        
        ctx.fillStyle = '#cbd5e1'; // Slate-300
        ctx.fillRect(x + 16, y + 32, 180, 4);
        ctx.globalAlpha = 1;
        ctx.restore();

        // Tags
        if (phase === 'order' && smoothT > 0.8) {
           const tagProgress = Math.min(1, (elapsed - 5000 - i * 100) / 500);
           if (tagProgress > 0) {
              ctx.save();
              ctx.globalAlpha = tagProgress;
              ctx.translate(x + BUBBLE_WIDTH - 80, y + 12);
              ctx.fillStyle = GOLD;
              drawRoundedRect(0, 0, 70, 18, 9);
              ctx.fill();
              ctx.fillStyle = '#fff';
              ctx.font = '10px Inter, sans-serif';
              ctx.fillText(b.tag, 10, 12);
              ctx.restore();
           }
           if (b.isAi && tagProgress > 0.5) {
             ctx.save();
             ctx.translate(x + 130, y + 16);
             ctx.fillStyle = GOLD;
             ctx.font = 'bold 10px Inter, sans-serif';
             ctx.fillText("AI REPLYING...", 0, 0);
             ctx.restore();
           }
        }
      });

      // Scan Line
      if (phase === 'order') {
        const scanProgress = (elapsed - 5000) / 2000;
        if (scanProgress > 0 && scanProgress < 1.5) {
          const scanY = (height * 0.2) + (scanProgress * height * 0.6);
          const grad = ctx.createLinearGradient(0, scanY - 20, 0, scanY + 20);
          grad.addColorStop(0, 'rgba(74, 93, 35, 0)');
          grad.addColorStop(0.5, 'rgba(74, 93, 35, 0.2)'); // Lighter scan
          grad.addColorStop(1, 'rgba(74, 93, 35, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, scanY - 20, width, 40);
          ctx.beginPath();
          ctx.moveTo(0, scanY);
          ctx.lineTo(width, scanY);
          ctx.strokeStyle = GOLD;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      animationFrameId = requestAnimationFrame(render);
    };
    render(performance.now());
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-[450px] md:h-[550px] relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-xl group cursor-default">
      <div className="absolute top-6 left-6 flex gap-2 z-10 opacity-60">
        <div className="w-3 h-3 rounded-full bg-slate-200"></div>
        <div className="w-3 h-3 rounded-full bg-slate-200"></div>
        <div className="w-3 h-3 rounded-full bg-slate-200"></div>
      </div>
      <div className="absolute top-6 right-8 z-10 flex flex-col items-end">
         <div className="text-[10px] font-mono text-slate-400 tracking-widest uppercase mb-1">System Status</div>
         <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#4A5D23] animate-pulse"></div>
            <span className="text-xs font-bold text-[#4A5D23]">AI ACTIVE</span>
         </div>
      </div>
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(255,255,255,0.4)_100%)] pointer-events-none"></div>
    </div>
  );
};

// --- Animation: Action Engine (Brain to Action) (Light Theme) ---
const ActionEngineAnimation: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = container.offsetWidth;
    let height = container.offsetHeight;
    let animationFrameId: number;

    const resize = () => {
      width = container.offsetWidth;
      height = container.offsetHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', resize);
    resize();

    const COLORS = {
        BLUE: { main: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
        PURPLE: { main: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' },
        BRAND: { main: ACCENT_COLOR, glow: 'rgba(74, 93, 35, 0.3)' },
        SLATE: '#cbd5e1', // Slate-300 for inactive
        TEXT: '#475569', // Slate-600
        WHITE: '#FFFFFF'
    };
    
    const SCENARIOS = [
        { targetIdx: 0, theme: COLORS.BLUE, intent: "INQUIRY", action: "AUTO REPLY" },
        { targetIdx: 2, theme: COLORS.PURPLE, intent: "NEW LEAD", action: "LEAD SAVED" },
        { targetIdx: 1, theme: COLORS.BRAND, intent: "BOOKING", action: "CONFIRMED" }
    ];

    let startTime = performance.now();
    const scenarioDuration = 5000;
    const totalCycle = SCENARIOS.length * scenarioDuration;

    const render = (time: number) => {
      const elapsed = (time - startTime) % totalCycle;
      const scenarioIdx = Math.floor(elapsed / scenarioDuration);
      const scenarioProgress = (elapsed % scenarioDuration) / scenarioDuration;
      const currentScenario = SCENARIOS[scenarioIdx];
      const THEME = currentScenario.theme;

      ctx.clearRect(0, 0, width, height);
      const centerY = height / 2;
      const startX = width * 0.15;
      const brainX = width * 0.5;
      const endX = width * 0.85;

      const actions = [
        { label: "Auto Reply", y: centerY - 80 },
        { label: "Booking Confirmed", y: centerY },
        { label: "Lead Saved", y: centerY + 80 }
      ];

      actions.forEach((action, idx) => {
        const isTarget = idx === currentScenario.targetIdx;
        const isActive = isTarget && scenarioProgress > 0.6;
        
        ctx.beginPath();
        ctx.moveTo(brainX, centerY);
        ctx.lineTo(endX, action.y);
        ctx.strokeStyle = isActive ? THEME.main : COLORS.SLATE;
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.setLineDash(isActive ? [] : [5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(endX, action.y, isActive ? 8 : 6, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? THEME.main : '#f1f5f9'; // Slate-100 inactive
        ctx.strokeStyle = isActive ? THEME.main : COLORS.SLATE;
        if (isActive) {
            ctx.shadowColor = THEME.main;
            ctx.shadowBlur = 10;
        }
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font = isActive ? 'bold 12px Inter, sans-serif' : '12px Inter, sans-serif';
        ctx.fillStyle = isActive ? THEME.main : '#94a3b8'; // Slate-400
        ctx.textAlign = 'left';
        ctx.fillText(action.label, endX + 15, action.y + 4);
      });

      // Incoming Message box
      if (scenarioProgress < 0.35) {
        const p1 = Math.min(1, scenarioProgress / 0.3);
        const ease = 1 - Math.pow(1 - p1, 3);
        const curX = startX + (brainX - startX - 40) * ease;
        const opacity = 1 - Math.max(0, (scenarioProgress - 0.3) * 10);
        ctx.globalAlpha = opacity;
        
        // Message Bubble
        ctx.fillStyle = COLORS.WHITE;
        ctx.shadowColor = 'rgba(0,0,0,0.1)';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.roundRect(curX - 25, centerY - 18, 50, 36, 8);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#e2e8f0';
        ctx.stroke();

        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(curX - 15, centerY - 6, 30, 4);
        ctx.fillRect(curX - 15, centerY + 2, 20, 4);
        ctx.globalAlpha = 1;
      }

      // Brain Node
      const isProcessing = scenarioProgress > 0.3 && scenarioProgress < 0.7;
      let brainSize = 30;
      if (isProcessing) brainSize += Math.sin((time / 100) * 2) * 2;
      
      if (isProcessing) {
          ctx.shadowColor = THEME.main;
          ctx.shadowBlur = 15;
      }
      ctx.beginPath();
      ctx.arc(brainX, centerY, brainSize, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = isProcessing ? THEME.main : '#cbd5e1';
      ctx.lineWidth = isProcessing ? 3 : 2;
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.textAlign = 'center';
      ctx.font = '10px Inter, sans-serif';
      if (scenarioProgress < 0.3) {
          ctx.fillStyle = '#94a3b8';
          ctx.fillText("READY", brainX, centerY + 4);
      } else if (scenarioProgress < 0.5) {
          ctx.fillStyle = THEME.main;
          ctx.fillText("AI...", brainX, centerY + 4);
      } else {
          ctx.fillStyle = THEME.main;
          ctx.font = 'bold 10px Inter, sans-serif';
          ctx.fillText(currentScenario.intent, brainX, centerY + 4);
      }

      // Action Particle
      if (scenarioProgress > 0.55 && scenarioProgress < 0.9) {
         const flowProgress = (scenarioProgress - 0.55) / 0.35;
         const targetY = actions[currentScenario.targetIdx].y;
         const lineX = brainX + (endX - brainX) * flowProgress;
         const lineY = centerY + (targetY - centerY) * flowProgress;
         ctx.beginPath();
         ctx.arc(lineX, lineY, 4, 0, Math.PI * 2);
         ctx.fillStyle = THEME.main;
         ctx.fill();
      }
      animationFrameId = requestAnimationFrame(() => render(performance.now()));
    };
    render(performance.now());
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-[400px] bg-white rounded-xl border border-slate-200 relative overflow-hidden shadow-lg">
       <div className="absolute top-4 left-4 text-xs font-mono text-slate-400 uppercase">Action Engine v1.0</div>
       <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// --- Animation: Product (Dashboard Sim) (Light Theme) ---
const ProductAnimation: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = container.offsetWidth;
    let height = container.offsetHeight;
    let animationFrameId: number;

    const resize = () => {
      width = container.offsetWidth;
      height = container.offsetHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', resize);
    resize();

    const BRAND = ACCENT_COLOR;
    const THREAD_HEIGHT = 60;
    const GAP = 10;
    const threads = [
        { id: 1, name: "Lead A", tag: "Hot Lead", color: BRAND, score: 95 },
        { id: 2, name: "Lead B", tag: "Inquiry", color: '#94a3b8', score: 40 },
        { id: 3, name: "Lead C", tag: "Booking", color: '#3b82f6', score: 85 },
        { id: 4, name: "Lead D", tag: "Follow-up", color: '#a855f7', score: 60 },
        { id: 5, name: "Lead E", tag: "Closed", color: '#22c55e', score: 10 },
    ];

    let startTime = performance.now();
    const cycleDuration = 10000;

    const render = (time: number) => {
        const elapsed = (time - startTime) % cycleDuration;
        const phase = elapsed / cycleDuration;
        ctx.clearRect(0, 0, width, height);
        
        // Background Grid (very faint)
        ctx.strokeStyle = 'rgba(0,0,0,0.03)';
        ctx.lineWidth = 1;
        for(let i=0; i<width; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,height); ctx.stroke(); }
        for(let i=0; i<height; i+=40) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(width,i); ctx.stroke(); }

        const sortProgress = Math.min(1, Math.max(0, (phase * 10 - 1) / 2)); 
        const sortedIndices = [0, 3, 1, 2, 4];
        
        threads.forEach((t, i) => {
             const targetIdx = sortedIndices[i];
             const currentIdx = i + (targetIdx - i) * sortProgress;
             const y = 60 + currentIdx * (THREAD_HEIGHT + GAP);
             const x = 40;
             const w = width * 0.4; 
             
             // Row Background (White Card)
             ctx.fillStyle = '#ffffff';
             ctx.shadowColor = 'rgba(0,0,0,0.05)';
             ctx.shadowBlur = 4;
             ctx.shadowOffsetY = 2;
             
             if (i === 0 && phase > 0.4) {
                 ctx.strokeStyle = BRAND;
                 ctx.lineWidth = 2;
             } else {
                 ctx.strokeStyle = '#e2e8f0'; // Slate-200
                 ctx.lineWidth = 1;
             }
             
             ctx.beginPath();
             ctx.roundRect(x, y, w, THREAD_HEIGHT, 8);
             ctx.fill();
             ctx.shadowBlur = 0; // Clear shadow
             ctx.shadowOffsetY = 0;
             ctx.stroke();
             ctx.lineWidth = 1;
             
             // Placeholder Text Lines
             ctx.fillStyle = '#cbd5e1'; // Slate-300
             ctx.fillRect(x + 10, y + 15, 80, 8); 
             ctx.fillStyle = '#e2e8f0'; // Slate-200
             ctx.fillRect(x + 10, y + 35, 120, 6); 
             
             // Tag
             if (phase > 0.3) {
                 const tagOpacity = Math.min(1, (phase - 0.3) * 5);
                 ctx.globalAlpha = tagOpacity;
                 ctx.fillStyle = t.color;
                 ctx.beginPath();
                 ctx.roundRect(x + w - 70, y + 15, 60, 16, 4);
                 ctx.fill();
                 ctx.fillStyle = '#fff';
                 ctx.font = 'bold 9px Inter';
                 ctx.fillText(t.tag, x + w - 65, y + 26);
                 ctx.globalAlpha = 1;
             }
        });

        // AI Panel Overlay
        if (phase > 0.4) {
            const openProgress = Math.min(1, (phase - 0.4) * 4);
            const panelX = width * 0.5 + (1 - openProgress) * 50;
            const panelW = width * 0.4;
            ctx.globalAlpha = openProgress;
            
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#e2e8f0';
            ctx.shadowColor = 'rgba(0,0,0,0.1)';
            ctx.shadowBlur = 20;
            
            ctx.beginPath();
            ctx.roundRect(panelX, 60, panelW, height - 120, 12);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.stroke();
            
            ctx.fillStyle = BRAND;
            ctx.font = 'bold 14px Inter';
            ctx.fillText("AI PROCESSING", panelX + 20, 90);
            
            const actions = ["Intent Analysis", "CRM Update", "Drafting Reply", "Scheduled"];
            actions.forEach((act, idx) => {
                const actStart = 0.5 + idx * 0.1;
                if (phase > actStart) {
                    const y = 130 + idx * 40;
                    ctx.strokeStyle = BRAND;
                    ctx.beginPath();
                    ctx.arc(panelX + 30, y, 8, 0, Math.PI * 2);
                    ctx.stroke();
                    if (phase > actStart + 0.05) {
                        ctx.fillStyle = BRAND;
                        ctx.fill();
                    }
                    ctx.fillStyle = '#334155'; // Slate-700
                    ctx.font = '12px Inter';
                    ctx.fillText(act, panelX + 50, y + 4);
                }
            });
            ctx.globalAlpha = 1;
        }
        animationFrameId = requestAnimationFrame(() => render(performance.now()));
    };
    render(performance.now());
    return () => {
        window.removeEventListener('resize', resize);
        cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-[500px] bg-white rounded-2xl border border-slate-200 relative overflow-hidden shadow-xl">
        <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// --- Animation: Cooperation (Map) (Light Theme) ---
const CooperationAnimation: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      let width = container.offsetWidth;
      let height = container.offsetHeight;
      let animationFrameId: number;
      const resize = () => {
        width = container.offsetWidth;
        height = container.offsetHeight;
        canvas.width = width;
        canvas.height = height;
      };
      window.addEventListener('resize', resize);
      resize();
  
      const BRAND = ACCENT_COLOR;
      const NODES = [
          { x: 0.5, y: 0.5, label: "Malaysia", delay: 0 },
          { x: 0.6, y: 0.6, label: "Singapore", delay: 1000 },
          { x: 0.4, y: 0.7, label: "Indonesia", delay: 2000 },
          { x: 0.45, y: 0.3, label: "Thailand", delay: 3000 },
          { x: 0.65, y: 0.35, label: "Vietnam", delay: 4000 },
      ];
      
      let startTime = performance.now();
      const cycleDuration = 10000;
  
      const render = (time: number) => {
          const elapsed = (time - startTime) % cycleDuration;
          ctx.clearRect(0, 0, width, height);
          
          NODES.forEach((node, i) => {
              if (elapsed > node.delay) {
                  const cx = node.x * width;
                  const cy = node.y * height;
                  const activeTime = elapsed - node.delay;
                  const scale = Math.min(1, activeTime / 500);
                  
                  if (i > 0) {
                       const mainX = NODES[0].x * width;
                       const mainY = NODES[0].y * height;
                       const lineProgress = Math.min(1, activeTime / 1000);
                       const lx = mainX + (cx - mainX) * lineProgress;
                       const ly = mainY + (cy - mainY) * lineProgress;
                       ctx.beginPath();
                       ctx.moveTo(mainX, mainY);
                       ctx.lineTo(lx, ly);
                       ctx.strokeStyle = 'rgba(74, 93, 35, 0.2)';
                       ctx.lineWidth = 1;
                       ctx.stroke();
                  }
                  
                  ctx.beginPath();
                  ctx.arc(cx, cy, 6 * scale, 0, Math.PI * 2);
                  ctx.fillStyle = activeTime > 2000 ? BRAND : '#cbd5e1'; 
                  ctx.fill();
                  
                  const pulse = (Math.sin(time * 0.005 + i) + 1) / 2;
                  ctx.beginPath();
                  ctx.arc(cx, cy, 6 * scale + pulse * 10, 0, Math.PI * 2);
                  ctx.strokeStyle = `rgba(74, 93, 35, ${0.3 - pulse * 0.3})`;
                  ctx.stroke();
                  
                  ctx.fillStyle = '#64748b'; // Slate-500
                  ctx.font = '10px Inter';
                  ctx.textAlign = 'center';
                  ctx.fillText(node.label, cx, cy + 20);
              }
          });
          animationFrameId = requestAnimationFrame(() => render(performance.now()));
      };
      render(performance.now());
      return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animationFrameId); };
    }, []);
  
    return (
      <div ref={containerRef} className="w-full h-[400px] bg-white rounded-2xl border border-slate-200 relative overflow-hidden shadow-lg">
         <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    );
};

// --- Animation: Brand (Industry Morphing) (Light Theme) ---
const BrandAnimation: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      let width = container.offsetWidth;
      let height = container.offsetHeight;
      let animationFrameId: number;
      const resize = () => {
        width = container.offsetWidth;
        height = container.offsetHeight;
        canvas.width = width;
        canvas.height = height;
      };
      window.addEventListener('resize', resize);
      resize();
  
      const BRAND = ACCENT_COLOR;
      const INDUSTRIES = [
          { name: "Real Estate", label: "Property Inquiry", icon: "🏠", action: "BOOKED" },
          { name: "Insurance", label: "Policy Quote", icon: "🛡️", action: "QUOTED" },
          { name: "Education", label: "Course Info", icon: "🎓", action: "SENT" },
          { name: "Retail", label: "Order Status", icon: "🛍️", action: "SOLD" }
      ];
      
      let startTime = performance.now();
      const phaseDuration = 4000;
      const cycleDuration = INDUSTRIES.length * phaseDuration;
  
      const render = (time: number) => {
          const elapsed = (time - startTime) % cycleDuration;
          const currentIdx = Math.floor(elapsed / phaseDuration);
          const phaseProgress = (elapsed % phaseDuration) / phaseDuration;
          const industry = INDUSTRIES[currentIdx];
          
          ctx.clearRect(0, 0, width, height);
          const centerX = width / 2;
          const centerY = height / 2;

          const phoneW = 160; 
          const phoneH = 280; 
          const phoneX = centerX - phoneW / 2;
          const phoneY = centerY - phoneH / 2;
          
          // Phone Body (Light)
          ctx.fillStyle = '#ffffff'; 
          ctx.shadowColor = 'rgba(0,0,0,0.1)';
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.roundRect(phoneX, phoneY, phoneW, phoneH, 24);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#e2e8f0'; // Slate-200
          ctx.lineWidth = 4;
          ctx.stroke();

          ctx.fillStyle = BRAND;
          ctx.font = 'bold 10px Inter';
          ctx.textAlign = 'center';
          ctx.fillText(industry.label.toUpperCase(), centerX, phoneY + 45);

          const chatY = phoneY + 80;
          if (phaseProgress > 0.1) {
              const slideIn = Math.min(1, (phaseProgress - 0.1) * 5);
              ctx.globalAlpha = slideIn;
              ctx.fillStyle = '#f1f5f9'; // Slate-100
              ctx.beginPath();
              ctx.roundRect(phoneX + 15, chatY, 120, 34, 12);
              ctx.fill();
              ctx.globalAlpha = 1;
          }

          if (phaseProgress > 0.5) {
               const slideIn = Math.min(1, (phaseProgress - 0.5) * 5);
               ctx.globalAlpha = slideIn;
               ctx.fillStyle = BRAND;
               ctx.beginPath();
               ctx.roundRect(phoneX + phoneW - 135, chatY + 50, 120, 40, 12);
               ctx.fill();
               ctx.globalAlpha = 1;
          }
          
          INDUSTRIES.forEach((ind, i) => {
            const angle = (i / INDUSTRIES.length) * Math.PI * 2 - Math.PI / 2 + Math.PI / 4;
            const radius = Math.min(width, height) * 0.38;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            const isActive = i === currentIdx;

            ctx.beginPath();
            ctx.arc(x, y, isActive ? 28 : 20, 0, Math.PI * 2);
            ctx.fillStyle = isActive ? BRAND : '#e2e8f0'; // Slate-200
            ctx.fill();
            
            ctx.font = '20px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = isActive ? '#fff' : '#64748b';
            ctx.fillText(ind.icon, x, y + 2);
        });
  
        animationFrameId = requestAnimationFrame(() => render(performance.now()));
      };
      render(performance.now());
      return () => cancelAnimationFrame(animationFrameId);
    }, []);
  
    return (
      <div ref={containerRef} className="w-full h-[500px] bg-white rounded-2xl border border-slate-200 relative overflow-hidden shadow-lg">
          <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    );
};

// --- Early Access Modal ---
const EarlyAccessModal = ({ open, onOpenChange, plan, billing }: { open: boolean, onOpenChange: (val: boolean) => void, plan: string, billing: string }) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    workEmail: '',
    companyName: '',
    industry: '',
    teamSize: '',
    estimatedConversations: ''
  });

  useEffect(() => {
    if (open) setSuccess(false);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (supabase) {
        await supabase.from('early_access_signups').insert([{
            full_name: formData.fullName,
            work_email: formData.workEmail,
            company_name: formData.companyName,
            industry: formData.industry,
            team_size: formData.teamSize,
            selected_plan: plan,
            billing_preference: billing,
            estimated_conversations: formData.estimatedConversations,
            created_at: new Date().toISOString()
        }]);
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setSuccess(true); 
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] bg-white text-slate-900 border-slate-200">
            {!success ? (
                <>
                    <DialogHeader>
                        <DialogTitle>Get Early Access</DialogTitle>
                        <DialogDescription className="text-slate-500">
                            You selected the <span className="text-[#4A5D23] font-bold">{plan}</span> plan ({billing}).
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Input required name="fullName" placeholder="Full Name" className="bg-slate-50 border-slate-300" value={formData.fullName} onChange={handleChange} />
                            <Input required name="workEmail" type="email" placeholder="Work Email" className="bg-slate-50 border-slate-300" value={formData.workEmail} onChange={handleChange} />
                        </div>
                        <Input name="companyName" placeholder="Company Name" className="bg-slate-50 border-slate-300" value={formData.companyName} onChange={handleChange} />
                        <Button type="submit" className="w-full bg-[#4A5D23] hover:bg-[#3A4A1C] text-white mt-4" disabled={loading}>
                            {loading ? 'Submitting...' : 'Join Waitlist'}
                        </Button>
                    </form>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-[#4A5D23]/10 flex items-center justify-center">
                        <CheckIcon className="h-8 w-8 text-[#4A5D23]" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900">You're on the list!</h3>
                    <Button onClick={() => onOpenChange(false)} variant="outline" className="mt-4 border-slate-200 text-slate-700 hover:bg-slate-50">Close</Button>
                </div>
            )}
        </DialogContent>
    </Dialog>
  );
};

// --- Pricing Section Component ---
const PricingSection = () => {
    const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState('');

    const handlePlanClick = (planName: string) => {
        setSelectedPlan(planName);
        setModalOpen(true);
    };

    return (
        <section id="pricing" className="py-24 bg-slate-50 border-b border-slate-200 relative">
            <div className="container mx-auto px-4 relative z-10">
                <div className="text-center mb-12">
                    <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900">
                        Simple Pricing. <span className="text-[#4A5D23]">Powered by Credits.</span>
                    </h2>
                    <p className="text-slate-500 text-lg">
                        Start free. Scale only when your WhatsApp sales grow.
                    </p>
                    <div className="flex justify-center items-center mt-8">
                        <div className="bg-white p-1 rounded-full border border-slate-200 inline-flex relative shadow-sm">
                            <button onClick={() => setBilling('monthly')} className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${billing === 'monthly' ? 'bg-[#4A5D23] text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}>Monthly</button>
                            <button onClick={() => setBilling('yearly')} className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${billing === 'yearly' ? 'bg-[#4A5D23] text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}>Yearly</button>
                        </div>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {/* Free Plan */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col hover:border-[#4A5D23]/50 hover:shadow-lg transition-all">
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-slate-900">Free</h3>
                            <div className="mt-2 flex items-baseline gap-1"><span className="text-4xl font-bold text-slate-900">RM 0</span></div>
                            <p className="text-sm text-slate-500 mt-2">For individuals and early testing</p>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            <li className="flex items-start gap-3 text-sm text-slate-600"><CheckIcon className="h-5 w-5 text-[#4A5D23] shrink-0" /><span>AI Smart Inbox (basic)</span></li>
                            <li className="flex items-start gap-3 text-sm text-slate-900 font-semibold pt-2 border-t border-slate-100"><div className="h-5 w-5 rounded-full bg-[#4A5D23]/10 flex items-center justify-center shrink-0 text-[#4A5D23] text-[10px]">⚡</div><span>30 credits / month</span></li>
                        </ul>
                        <Button variant="outline" className="w-full border-slate-300 hover:bg-slate-50 text-slate-900" onClick={() => handlePlanClick('Free')}>Join Free</Button>
                    </div>

                    {/* Starter Plan */}
                    <div className="bg-white rounded-2xl border-2 border-[#4A5D23] p-8 flex flex-col relative shadow-xl shadow-[#4A5D23]/10 scale-105 z-10">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#4A5D23] text-white text-xs font-bold px-3 py-1 rounded-full">MOST POPULAR</div>
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-[#4A5D23]">Starter</h3>
                            <div className="mt-2 flex items-baseline gap-1"><span className="text-4xl font-bold text-slate-900">{billing === 'monthly' ? 'RM 299' : 'RM 2,870'}</span></div>
                            <p className="text-sm text-slate-500 mt-2">For growing teams selling on WhatsApp</p>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            <li className="flex items-start gap-3 text-sm text-slate-600"><CheckIcon className="h-5 w-5 text-[#4A5D23] shrink-0" /><span>Workflow AI (industry actions)</span></li>
                            <li className="flex items-start gap-3 text-sm text-slate-900 font-semibold pt-2 border-t border-slate-100"><div className="h-5 w-5 rounded-full bg-[#4A5D23]/10 flex items-center justify-center shrink-0 text-[#4A5D23] text-[10px]">⚡</div><span>500 credits / month</span></li>
                        </ul>
                        <Button className="w-full bg-[#4A5D23] hover:bg-[#3A4A1C] text-white shadow-lg" onClick={() => handlePlanClick('Starter')}>Request Early Access</Button>
                    </div>

                    {/* Pro Plan */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col hover:border-[#4A5D23]/50 hover:shadow-lg transition-all">
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-slate-900">Pro</h3>
                            <div className="mt-2 flex items-baseline gap-1"><span className="text-4xl font-bold text-slate-900">{billing === 'monthly' ? 'RM 899' : 'RM 8,630'}</span></div>
                            <p className="text-sm text-slate-500 mt-2">For high-volume & revenue teams</p>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            <li className="flex items-start gap-3 text-sm text-slate-600"><CheckIcon className="h-5 w-5 text-[#4A5D23] shrink-0" /><span>Advanced AI automation modules</span></li>
                            <li className="flex items-start gap-3 text-sm text-slate-900 font-semibold pt-2 border-t border-slate-100"><div className="h-5 w-5 rounded-full bg-[#4A5D23]/10 flex items-center justify-center shrink-0 text-[#4A5D23] text-[10px]">⚡</div><span>2,000 credits / month</span></li>
                        </ul>
                        <Button variant="outline" className="w-full border-slate-300 hover:bg-slate-50 text-slate-900" onClick={() => handlePlanClick('Pro')}>Request Early Access</Button>
                    </div>
                </div>
                <EarlyAccessModal open={modalOpen} onOpenChange={setModalOpen} plan={selectedPlan} billing={billing} />
            </div>
        </section>
    );
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-24 font-sans">
      {/* Floating Header */}
      <header className="fixed bottom-0 left-0 right-0 z-50 w-full px-4 pb-4 pointer-events-none">
        <div className="mx-auto w-fit max-w-[95%] md:max-w-4xl flex flex-col-reverse items-center gap-2 pointer-events-auto">
          {menuOpen && (
            <nav className="w-full flex flex-col bg-white/95 backdrop-blur-xl border border-slate-200 rounded-xl p-4 md:hidden shadow-xl mb-2">
              {['How it works', 'Features', 'Services', 'Pricing', 'FAQ'].map(item => (
                  <a key={item} onClick={() => setMenuOpen(false)} href={`#${item.toLowerCase().replace(/\s/g, '-')}`} className="py-2 text-slate-600 hover:text-[#4A5D23] transition-colors">{item}</a>
              ))}
              <Link onClick={() => setMenuOpen(false)} to="/auth" className="py-2 text-slate-600 hover:text-[#4A5D23] transition-colors">SignIn</Link>
            </nav>
          )}
          <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl px-10 py-4 flex items-center gap-6 shadow-xl">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <img src="https://rwlecxyfukzberxcpqnr.supabase.co/storage/v1/object/public/general/inShoppe%20Logo.png" className="h-8 w-auto" />
            </Link>
            <nav className="hidden md:flex items-center gap-4">
              {['How it works', 'Features', 'Services', 'Pricing', 'FAQ'].map(item => (
                  <a key={item} href={`#${item.toLowerCase().replace(/\s/g, '-')}`} className="text-lg text-slate-600 hover:text-[#4A5D23] transition-colors">{item}</a>
              ))}
              <Link to="/auth" className="text-lg text-slate-600 hover:text-[#4A5D23] transition-colors">SignIn</Link>
            </nav>
            <button className="md:hidden text-slate-600 ml-auto" onClick={() => setMenuOpen(!menuOpen)}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-20 pb-20 md:pt-24 md:pb-32 bg-white">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[#4A5D23]/10 border border-[#4A5D23]/20 rounded-full px-4 py-2 mb-8">
            <span className="text-sm text-[#4A5D23] font-medium">Best WhatsApp AI Action Agent for Business</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            <span className="text-[#4A5D23]">Where WhatsApp Becomes</span><br />
            <span className="text-slate-900">an AI Action Engine!</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed">
            An AI action engine that understands intent, executes workflows, and drives revenue on WhatsApp.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="bg-[#4A5D23] hover:bg-[#3A4A1C] text-white font-semibold px-8 py-4 rounded-3xl transition-all duration-200 shadow-lg shadow-[#4A5D23]/20 hover:shadow-[#4A5D23]/40 hover:scale-105">
              Join the waitlist!
            </button>
          </div>
        </div>
      </section>

      {/* SOLVING SECTION (SolvingAnimation) */}
      <section className="py-24 bg-slate-50 border-y border-slate-200 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-8 animate-fade-in-up">
              <h2 className="text-4xl md:text-5xl font-bold leading-tight text-slate-900">
                Selling Happens on WhatsApp. <br/>
                <span className="text-[#4A5D23]">Managing It Is Chaos.</span>
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                Businesses rely on WhatsApp to close deals, handle inquiries, and follow up with customers. 
                But conversations pile up, leads are missed, responses are delayed, and sales depend entirely on human memory.
              </p>
              <ul className="space-y-4">
                {["Messages flood in with no prioritization", "Hot leads get lost in long chat histories", "Follow-ups are inconsistent or forgotten", "Sales teams waste time repeating the same replies"].map((point, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-700">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#4A5D23]" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="absolute -top-10 -right-10 w-64 h-64 bg-[#4A5D23]/10 rounded-full blur-[80px] pointer-events-none"></div>
              <SolvingAnimation />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS (ActionEngineAnimation) */}
      <section id="how-it-works" className="py-24 bg-white relative">
         <div className="container mx-auto px-4">
             <div className="text-center mb-16">
                 <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900">
                    From Message to Action — <span className="text-[#4A5D23]">Automatically.</span>
                 </h2>
                 <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                    inShoppe AI understands customer intent, decides what to do, and executes the next business action.
                 </p>
             </div>
             
             {/* Updated Layout: Stacked for full width animation */}
             <div className="flex flex-col gap-12 mb-16 max-w-6xl mx-auto">
                 <div className="w-full shadow-2xl rounded-xl border border-slate-200/50">
                     <ActionEngineAnimation />
                 </div>
                 
                 <div className="grid md:grid-cols-3 gap-8">
                     {[
                         { title: "1. Understand Intent", text: "Incoming WhatsApp messages are analyzed to detect intent such as inquiry, booking, pricing request." },
                         { title: "2. Decision AI", text: "The AI decides the best course of action: answer from knowledge base, escalate to human, or trigger a workflow." }, 
                         { title: "3. Revenue Action", text: "It executes the action instantly—sending a booking link, saving a lead to CRM, or processing a purchase." }
                     ].map((step, i) => (
                        <div key={i} className="bg-slate-50 p-8 rounded-2xl border border-slate-200 h-full flex flex-col justify-center text-center md:text-left hover:border-[#4A5D23]/30 transition-colors">
                            <h3 className="text-xl font-bold mb-3 text-slate-900">{step.title}</h3>
                            <p className="text-slate-600 text-base leading-relaxed">{step.text}</p>
                        </div>
                     ))}
                 </div>
             </div>
         </div>
      </section>
      
      {/* FEATURES (ProductAnimation) */}
      <section id="features" className="py-24 bg-slate-50 border-y border-slate-200">
          <div className="container mx-auto px-4">
              <div className="text-center mb-16">
                  <h2 className="text-3xl font-bold mb-4 text-slate-900">Live Dashboard Simulation</h2>
                  <p className="text-slate-600">Watch how the AI organizes and responds to incoming leads in real-time.</p>
              </div>
              <div className="max-w-5xl mx-auto">
                  <ProductAnimation />
              </div>
          </div>
      </section>

      {/* EXPANSION (CooperationAnimation) */}
      <section id="services" className="py-24 bg-white border-b border-slate-200">
          <div className="container mx-auto px-4">
              <div className="grid md:grid-cols-2 gap-16 items-center">
                  <div>
                      <h2 className="text-3xl font-bold mb-6 text-slate-900">Scale Across Borders</h2>
                      <p className="text-slate-600 mb-6 text-lg">
                          Whether you are in Malaysia, Singapore, or expanding to Vietnam, our AI adapts to local languages and market contexts instantly.
                      </p>
                      <Button onClick={() => navigate('/auth')} className="bg-[#4A5D23] hover:bg-[#3A4A1C] text-white">Start Scaling</Button>
                  </div>
                  <CooperationAnimation />
              </div>
          </div>
      </section>

      {/* INDUSTRIES (BrandAnimation) */}
      <section className="py-24 bg-slate-50 border-b border-slate-200">
          <div className="container mx-auto px-4">
              <div className="text-center mb-16">
                  <h2 className="text-3xl font-bold mb-4 text-slate-900">Works for Every Industry</h2>
                  <p className="text-slate-600">From Real Estate to Retail, the engine adapts to your specific workflows.</p>
              </div>
              <div className="max-w-4xl mx-auto">
                  <BrandAnimation />
              </div>
          </div>
      </section>

      <PricingSection />
      
      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-white">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center text-slate-900">Common Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            {faqData.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="bg-white border border-slate-200 mb-4 rounded-xl px-6 py-4 shadow-sm">
                <AccordionTrigger className="text-lg hover:no-underline text-slate-900 hover:text-[#4A5D23]">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-slate-600 text-base mt-2">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 py-12 border-t border-slate-200 text-center text-slate-500 text-sm">
          <div className="container mx-auto px-4">
              <p>&copy; {new Date().getFullYear()} inShoppe AI. All rights reserved.</p>
          </div>
      </footer>
    </div>
  );
};

// Icons
function Play(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>;
}
function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
}

export default LandingPage;
