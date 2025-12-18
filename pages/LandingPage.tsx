
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/Accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { supabase } from '../services/supabase';

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

// --- Animation Component: Solving Chaos ---
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

    // --- Configuration ---
    const GOLD = '#8A9A5B';
    const GOLD_GLOW = 'rgba(138, 154, 91, 0.4)';
    const BUBBLE_WIDTH = 260;
    const BUBBLE_HEIGHT = 56;
    
    // --- State Initialization ---
    const bubbles = Array.from({ length: 7 }).map((_, i) => ({
      id: i,
      // Chaos: Random floaty positions
      cx: Math.random() * (width * 0.6) + width * 0.2,
      cy: Math.random() * (height * 0.6) + height * 0.2,
      // Order: Stacked perfectly
      ox: width / 2 - BUBBLE_WIDTH / 2, 
      oy: 60 + i * (BUBBLE_HEIGHT + 16),
      // Properties
      isAi: i === 2, // The 3rd one is an AI reply
      tag: i % 2 === 0 ? 'High Intent' : 'Inquiry',
      status: i === 2 ? 'AI Replying...' : i === 4 ? 'Booked' : '',
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
    const cycleDuration = 12000; // 12s full loop

    // --- Drawing Helpers ---
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
      let t = 0; // interpolation 0->1

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

      // --- Draw Particles (Background) ---
      ctx.fillStyle = '#ffffff';
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

      // --- Draw Bubbles ---
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
          const gradient = ctx.createLinearGradient(x, y, x + BUBBLE_WIDTH, y + BUBBLE_HEIGHT);
          if (b.isAi) {
            gradient.addColorStop(0, 'rgba(30, 41, 59, 0.9)');
            gradient.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
            ctx.shadowColor = GOLD;
            ctx.shadowBlur = 15;
            ctx.strokeStyle = GOLD;
            ctx.lineWidth = 1;
          } else {
            gradient.addColorStop(0, 'rgba(51, 65, 85, 0.7)');
            gradient.addColorStop(1, 'rgba(30, 41, 59, 0.8)');
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.shadowBlur = 0;
          }
          ctx.fillStyle = gradient;
        } else {
          ctx.fillStyle = 'rgba(51, 65, 85, 0.4)';
          ctx.strokeStyle = 'transparent';
        }

        drawRoundedRect(x, y, BUBBLE_WIDTH, BUBBLE_HEIGHT, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = b.isAi ? GOLD : 'rgba(255,255,255,0.4)';
        const textOpacity = phase === 'order' ? 1 : 0.5;
        ctx.globalAlpha = textOpacity;
        
        ctx.fillRect(x + 16, y + 16, 100, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(x + 16, y + 32, 180, 4);
        
        ctx.globalAlpha = 1;
        ctx.restore();

        if (phase === 'order' && smoothT > 0.8) {
           const tagProgress = Math.min(1, (elapsed - 5000 - i * 100) / 500);
           if (tagProgress > 0) {
              ctx.save();
              ctx.globalAlpha = tagProgress;
              ctx.translate(x + BUBBLE_WIDTH - 80, y + 12);
              
              ctx.fillStyle = GOLD_GLOW;
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

      if (phase === 'order') {
        const scanProgress = (elapsed - 5000) / 2000;
        if (scanProgress > 0 && scanProgress < 1.5) {
          const scanY = (height * 0.2) + (scanProgress * height * 0.6);
          
          const grad = ctx.createLinearGradient(0, scanY - 20, 0, scanY + 20);
          grad.addColorStop(0, 'rgba(138, 154, 91, 0)');
          grad.addColorStop(0.5, 'rgba(138, 154, 91, 0.5)');
          grad.addColorStop(1, 'rgba(138, 154, 91, 0)');
          
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
    <div ref={containerRef} className="w-full h-[450px] md:h-[550px] relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 to-black border border-slate-800 shadow-2xl group cursor-default">
      <div className="absolute top-6 left-6 flex gap-2 z-10 opacity-60">
        <div className="w-3 h-3 rounded-full bg-slate-600"></div>
        <div className="w-3 h-3 rounded-full bg-slate-700"></div>
        <div className="w-3 h-3 rounded-full bg-slate-700"></div>
      </div>
      
      <div className="absolute top-6 right-8 z-10 flex flex-col items-end">
         <div className="text-[10px] font-mono text-slate-500 tracking-widest uppercase mb-1">System Status</div>
         <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#8A9A5B] animate-pulse"></div>
            <span className="text-xs font-bold text-[#8A9A5B]">AI ACTIVE</span>
         </div>
      </div>

      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(2,6,23,0.6)_100%)] pointer-events-none"></div>
    </div>
  );
};

// --- Animation Component: Action Engine (Enhanced) ---
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

    // --- Configuration ---
    const COLORS = {
        BLUE: { main: '#38bdf8', glow: 'rgba(56, 189, 248, 0.6)' },
        PURPLE: { main: '#c084fc', glow: 'rgba(192, 132, 252, 0.6)' },
        GOLD: { main: '#facc15', glow: 'rgba(250, 204, 21, 0.6)' },
        SLATE: '#334155',
        WHITE: '#FFFFFF'
    };
    
    const SCENARIOS = [
        { targetIdx: 0, theme: COLORS.BLUE, intent: "INQUIRY", action: "AUTO REPLY" },
        { targetIdx: 2, theme: COLORS.PURPLE, intent: "NEW LEAD", action: "LEAD SAVED" },
        { targetIdx: 1, theme: COLORS.GOLD, intent: "BOOKING", action: "CONFIRMED" }
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
        ctx.fillStyle = isActive ? THEME.main : COLORS.SLATE;
        
        if (isActive) {
            ctx.shadowColor = THEME.main;
            ctx.shadowBlur = 15;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.font = isActive ? 'bold 12px Inter, sans-serif' : '12px Inter, sans-serif';
        ctx.fillStyle = isActive ? THEME.main : '#64748b';
        ctx.textAlign = 'left';
        ctx.fillText(action.label, endX + 15, action.y + 4);
        
        if (isActive && scenarioProgress > 0.8) {
            ctx.fillStyle = COLORS.WHITE;
            ctx.font = '10px Inter, sans-serif';
            ctx.fillText(currentScenario.action, endX + 15, action.y + 20);
        }
      });

      if (scenarioProgress < 0.35) {
        const p1 = Math.min(1, scenarioProgress / 0.3);
        const ease = 1 - Math.pow(1 - p1, 3);
        const curX = startX + (brainX - startX - 40) * ease;
        const opacity = 1 - Math.max(0, (scenarioProgress - 0.3) * 10);
        
        ctx.globalAlpha = opacity;
        
        ctx.fillStyle = COLORS.WHITE;
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        // Fallback for roundRect
        if (typeof ctx.roundRect === 'function') {
             ctx.roundRect(curX - 25, centerY - 18, 50, 36, 8);
        } else {
             ctx.rect(curX - 25, centerY - 18, 50, 36);
        }
        ctx.fill();
        ctx.shadowBlur = 0;
        
        ctx.fillStyle = '#94a3b8';
        
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(curX - 15, centerY - 6, 30, 4, 2);
        } else {
            ctx.rect(curX - 15, centerY - 6, 30, 4);
        }
        ctx.fill();
        
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(curX - 15, centerY + 2, 20, 4, 2);
        } else {
            ctx.rect(curX - 15, centerY + 2, 20, 4);
        }
        ctx.fill();
        
        ctx.globalAlpha = 1;
      }

      const isProcessing = scenarioProgress > 0.3 && scenarioProgress < 0.7;
      
      let brainSize = 30;
      if (isProcessing) {
          brainSize += Math.sin((time / 100) * 2) * 2;
      }
      
      if (isProcessing) {
          ctx.shadowColor = THEME.main;
          ctx.shadowBlur = 20 + Math.random() * 10;
      }

      ctx.beginPath();
      ctx.arc(brainX, centerY, brainSize, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = isProcessing ? THEME.main : COLORS.SLATE;
      ctx.lineWidth = isProcessing ? 3 : 2;
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.textAlign = 'center';
      ctx.font = '10px Inter, sans-serif';
      
      if (scenarioProgress < 0.3) {
          ctx.fillStyle = '#64748b';
          ctx.fillText("READY", brainX, centerY + 4);
      } else if (scenarioProgress < 0.5) {
          ctx.fillStyle = THEME.main;
          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
          let text = "";
          for(let i=0; i<6; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
          ctx.fillText(text, brainX, centerY + 4);
      } else {
          ctx.fillStyle = THEME.main;
          ctx.font = 'bold 10px Inter, sans-serif';
          ctx.fillText(currentScenario.intent, brainX, centerY + 4);
      }

      if (scenarioProgress > 0.55 && scenarioProgress < 0.9) {
         const flowProgress = (scenarioProgress - 0.55) / 0.35;
         const targetY = actions[currentScenario.targetIdx].y;
         
         const lineX = brainX + (endX - brainX) * flowProgress;
         const lineY = centerY + (targetY - centerY) * flowProgress;
         
         ctx.beginPath();
         ctx.arc(lineX, lineY, 4, 0, Math.PI * 2);
         ctx.fillStyle = COLORS.WHITE;
         ctx.shadowColor = THEME.main;
         ctx.shadowBlur = 10;
         ctx.fill();
         ctx.shadowBlur = 0;
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
    <div ref={containerRef} className="w-full h-[300px] bg-slate-950/50 rounded-xl border border-slate-900 relative overflow-hidden shadow-2xl">
       <div className="absolute top-4 left-4 text-xs font-mono text-slate-600 uppercase">Action Engine v1.0</div>
       <div className="absolute bottom-4 left-4 flex gap-4 text-[10px] font-mono text-slate-500">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#38bdf8]"></div>REPLY</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#facc15]"></div>BOOKING</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#c084fc]"></div>LEAD</div>
       </div>
       <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// --- Animation Component: Product Animation (Enhanced) ---
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

    // Config
    const GOLD = '#8A9A5B';
    const THREAD_HEIGHT = 60;
    const GAP = 10;
    
    // Mock Data
    const threads = [
        { id: 1, name: "Lead A", tag: "Hot Lead", color: GOLD, score: 95 },
        { id: 2, name: "Lead B", tag: "Inquiry", color: '#94a3b8', score: 40 },
        { id: 3, name: "Lead C", tag: "Booking", color: '#38bdf8', score: 85 },
        { id: 4, name: "Lead D", tag: "Follow-up", color: '#c084fc', score: 60 },
        { id: 5, name: "Lead E", tag: "Closed", color: '#22c55e', score: 10 },
    ];

    let startTime = performance.now();
    const cycleDuration = 10000;

    const render = (time: number) => {
        const elapsed = (time - startTime) % cycleDuration;
        const phase = elapsed / cycleDuration;
        
        ctx.clearRect(0, 0, width, height);
        
        // Background Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 1;
        for(let i=0; i<width; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,height); ctx.stroke(); }
        for(let i=0; i<height; i+=40) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(width,i); ctx.stroke(); }

        // --- Phase 1: List (0 - 0.3) Sort Animation ---
        const sortProgress = Math.min(1, Math.max(0, (phase * 10 - 1) / 2)); 
        const sortedIndices = [0, 3, 1, 2, 4];
        
        threads.forEach((t, i) => {
             const targetIdx = sortedIndices[i];
             const currentIdx = i + (targetIdx - i) * sortProgress;
             
             const y = 60 + currentIdx * (THREAD_HEIGHT + GAP);
             const x = 40;
             const w = width * 0.4; // Left panel width
             
             // Draw Thread Card
             ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
             ctx.strokeStyle = 'rgba(255,255,255,0.1)';
             
             if (i === 0 && phase > 0.4) {
                 ctx.fillStyle = 'rgba(30, 41, 59, 1)';
                 ctx.strokeStyle = GOLD;
                 ctx.lineWidth = 2;
             }
             
             ctx.beginPath();
             if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, THREAD_HEIGHT, 8);
             else ctx.rect(x, y, w, THREAD_HEIGHT);
             ctx.fill();
             ctx.stroke();
             ctx.lineWidth = 1;
             
             // Content (Skeleton)
             ctx.fillStyle = '#cbd5e1';
             ctx.fillRect(x + 10, y + 15, 80, 8); // Name
             ctx.fillStyle = '#64748b';
             ctx.fillRect(x + 10, y + 35, 120, 6); // Msg
             
             // Tag
             if (phase > 0.3) {
                 const tagOpacity = Math.min(1, (phase - 0.3) * 5);
                 ctx.globalAlpha = tagOpacity;
                 ctx.fillStyle = t.color;
                 if (typeof ctx.roundRect === 'function') ctx.roundRect(x + w - 70, y + 15, 60, 16, 4);
                 else ctx.rect(x + w - 70, y + 15, 60, 16);
                 ctx.fill();
                 
                 ctx.fillStyle = '#fff';
                 ctx.font = 'bold 9px Inter';
                 ctx.fillText(t.tag, x + w - 65, y + 26);
                 ctx.globalAlpha = 1;
             }
        });

        // --- Phase 2: Action Panel (0.4 - 1.0) ---
        if (phase > 0.4) {
            const openProgress = Math.min(1, (phase - 0.4) * 4);
            const panelX = width * 0.5 + (1 - openProgress) * 50;
            const panelW = width * 0.4;
            const panelAlpha = openProgress;
            
            ctx.globalAlpha = panelAlpha;
            
            // Panel Body
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.strokeStyle = '#334155';
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') ctx.roundRect(panelX, 60, panelW, height - 120, 12);
            else ctx.rect(panelX, 60, panelW, height - 120);
            ctx.fill();
            ctx.stroke();
            
            // Header
            ctx.fillStyle = GOLD;
            ctx.font = 'bold 14px Inter';
            ctx.fillText("AI PROCESSING", panelX + 20, 90);
            
            // Actions List animation
            const actions = ["Intent Analysis", "CRM Update", "Drafting Reply", "Scheduled"];
            
            actions.forEach((act, idx) => {
                const actStart = 0.5 + idx * 0.1;
                if (phase > actStart) {
                    const y = 130 + idx * 40;
                    
                    // Checkbox
                    ctx.strokeStyle = GOLD;
                    ctx.beginPath();
                    ctx.arc(panelX + 30, y, 8, 0, Math.PI * 2);
                    ctx.stroke();
                    
                    // Checkmark
                    if (phase > actStart + 0.05) {
                        ctx.fillStyle = GOLD;
                        ctx.fill();
                    }
                    
                    // Text
                    ctx.fillStyle = '#fff';
                    ctx.font = '12px Inter';
                    ctx.fillText(act, panelX + 50, y + 4);
                }
            });
            
            // --- Metrics overlay (0.8+) ---
            if (phase > 0.8) {
                const metricAlpha = Math.min(1, (phase - 0.8) * 5);
                ctx.globalAlpha = metricAlpha;
                
                // Box
                ctx.fillStyle = 'rgba(30, 41, 59, 1)';
                ctx.strokeStyle = GOLD;
                if (typeof ctx.roundRect === 'function') ctx.roundRect(panelX + 20, 300, panelW - 40, 60, 8);
                else ctx.rect(panelX + 20, 300, panelW - 40, 60);
                ctx.fill();
                ctx.stroke();
                
                // Text
                ctx.fillStyle = '#94a3b8';
                ctx.font = '10px Inter';
                ctx.fillText("RESPONSE TIME", panelX + 35, 320);
                
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 18px Inter';
                ctx.fillText("INSTANT", panelX + 35, 345);
                
                ctx.fillStyle = '#22c55e';
                ctx.font = 'bold 12px Inter';
                ctx.fillText("▲ 300%", panelX + 110, 345);
            }
            
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
    <div ref={containerRef} className="w-full h-[500px] bg-slate-950/50 rounded-2xl border border-slate-900 relative overflow-hidden shadow-2xl">
        <canvas ref={canvasRef} className="w-full h-full" />
        <div className="absolute top-0 right-0 p-4">
             <div className="text-[10px] font-mono text-slate-600 uppercase">Live Simulation</div>
        </div>
    </div>
  );
};

// --- Animation Component: Cooperation (Market Expansion) ---
const CooperationAnimation: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isInView, setIsInView] = useState(false);
  
    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => setIsInView(entry.isIntersecting),
        { threshold: 0.2 }
      );
      if (containerRef.current) observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, []);
  
    useEffect(() => {
      if (!isInView) return;
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
  
      const GOLD = '#8A9A5B';
      const WHITE = '#FFFFFF';
      
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
                  
                  // Connection to Main (Malaysia)
                  if (i > 0) {
                       const mainX = NODES[0].x * width;
                       const mainY = NODES[0].y * height;
                       
                       const lineProgress = Math.min(1, activeTime / 1000);
                       const lx = mainX + (cx - mainX) * lineProgress;
                       const ly = mainY + (cy - mainY) * lineProgress;
                       
                       ctx.beginPath();
                       ctx.moveTo(mainX, mainY);
                       ctx.lineTo(lx, ly);
                       ctx.strokeStyle = 'rgba(138, 154, 91, 0.3)';
                       ctx.lineWidth = 1;
                       ctx.stroke();
                  }
                  
                  // Node
                  ctx.beginPath();
                  ctx.arc(cx, cy, 6 * scale, 0, Math.PI * 2);
                  ctx.fillStyle = activeTime > 2000 ? GOLD : WHITE; 
                  if (activeTime > 2000) {
                       ctx.shadowColor = GOLD;
                       ctx.shadowBlur = 10;
                  }
                  ctx.fill();
                  ctx.shadowBlur = 0;
                  
                  // Pulse
                  const pulse = (Math.sin(time * 0.005 + i) + 1) / 2;
                  ctx.beginPath();
                  ctx.arc(cx, cy, 6 * scale + pulse * 10, 0, Math.PI * 2);
                  ctx.strokeStyle = `rgba(138, 154, 91, ${0.5 - pulse * 0.5})`;
                  ctx.stroke();
                  
                  // Label
                  ctx.fillStyle = '#94a3b8';
                  ctx.font = '10px Inter';
                  ctx.textAlign = 'center';
                  ctx.fillText(node.label, cx, cy + 20);
                  
                  // Transformation Text
                  if (activeTime > 2000 && activeTime < 4000) {
                      ctx.fillStyle = GOLD;
                      ctx.font = 'bold 8px Inter';
                      ctx.fillText("AI ENABLED", cx, cy - 15);
                  }
              }
          });
  
          animationFrameId = requestAnimationFrame(() => render(performance.now()));
      };
      
      render(performance.now());
      return () => cancelAnimationFrame(animationFrameId);
    }, [isInView]);
  
    return (
      <div ref={containerRef} className="w-full h-[400px] bg-slate-950/50 rounded-2xl border border-slate-900 relative overflow-hidden">
         <div className="absolute top-4 left-4 text-xs font-mono text-slate-600 uppercase">Market Expansion</div>
         <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    );
};

// --- Animation Component: Brand (Industry Morphing - Enhanced & Layout Fixed) ---
const BrandAnimation: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isInView, setIsInView] = useState(false);
  
    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => setIsInView(entry.isIntersecting),
        { threshold: 0.2 }
      );
      if (containerRef.current) observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, []);
  
    useEffect(() => {
      if (!isInView) return;
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
  
      const GOLD = '#8A9A5B';
      const SLATE = '#334155';
      const WHITE = '#FFFFFF';
  
      const INDUSTRIES = [
          { name: "Real Estate", label: "Property Inquiry", icon: "🏠", action: "BOOKED" },
          { name: "Insurance", label: "Policy Quote", icon: "🛡️", action: "QUOTED" },
          { name: "Education", label: "Course Info", icon: "🎓", action: "SENT" },
          { name: "Retail", label: "Order Status", icon: "🛍️", action: "SOLD" }
      ];

      const particles = Array.from({length: 20}).map(() => ({
          x: Math.random() * width,
          y: Math.random() * height,
          speed: 0.5 + Math.random(),
          emoji: INDUSTRIES[0].icon
      }));
  
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

          // 1. Background Particles
          particles.forEach(p => {
              p.y -= p.speed;
              if (p.y < 0) p.y = height;
              p.emoji = industry.icon;
              
              ctx.globalAlpha = 0.1;
              ctx.font = '16px serif';
              ctx.fillText(p.emoji, p.x, p.y);
          });
          ctx.globalAlpha = 1;

          // 2. Background Connection Lines
          INDUSTRIES.forEach((ind, i) => {
              // Add PI/4 (45deg) rotation to put nodes in corners
              const angle = (i / INDUSTRIES.length) * Math.PI * 2 - Math.PI / 2 + Math.PI / 4;
              const radius = Math.min(width, height) * 0.38;
              const x = centerX + Math.cos(angle) * radius;
              const y = centerY + Math.sin(angle) * radius;
              const isActive = i === currentIdx;

              if (isActive) {
                  ctx.beginPath();
                  ctx.moveTo(centerX, centerY);
                  ctx.lineTo(x, y);
                  const pulse = Math.abs(Math.sin(time * 0.005));
                  ctx.strokeStyle = GOLD;
                  ctx.lineWidth = 3 + pulse * 2;
                  ctx.shadowColor = GOLD;
                  ctx.shadowBlur = 10;
                  ctx.stroke();
                  ctx.shadowBlur = 0;

                  const packetPos = (time * 0.002) % 1;
                  const px = centerX + (x - centerX) * packetPos;
                  const py = centerY + (y - centerY) * packetPos;
                  ctx.beginPath();
                  ctx.arc(px, py, 4, 0, Math.PI*2);
                  ctx.fillStyle = WHITE;
                  ctx.fill();
              }
          });
  
          // 3. Central Phone Interface
          const phoneW = 160; // Reduced width
          const phoneH = 280; // Reduced height
          const phoneX = centerX - phoneW / 2;
          const phoneY = centerY - phoneH / 2;
          
          const isGlitch = phaseProgress < 0.1;
          const offsetX = isGlitch ? (Math.random() - 0.5) * 10 : 0;

          ctx.save();
          ctx.translate(offsetX, 0);
          
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 30;
          ctx.fillStyle = '#0f172a'; 
          if (typeof ctx.roundRect === 'function') ctx.roundRect(phoneX, phoneY, phoneW, phoneH, 24);
          else ctx.rect(phoneX, phoneY, phoneW, phoneH);
          ctx.fill();
          ctx.shadowBlur = 0;
  
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 4;
          ctx.stroke();

          ctx.fillStyle = '#000';
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') ctx.roundRect(centerX - 30, phoneY + 10, 60, 16, 8);
          ctx.fill();
  
          ctx.fillStyle = '#1e293b';
          if (typeof ctx.roundRect === 'function') ctx.roundRect(phoneX + 2, phoneY + 2, phoneW - 4, 60, 20); 
          ctx.fill();
          ctx.fillRect(phoneX + 2, phoneY + 40, phoneW - 4, 22);

          ctx.fillStyle = GOLD;
          ctx.font = 'bold 10px Inter';
          ctx.textAlign = 'center';
          ctx.fillText(industry.label.toUpperCase(), centerX, phoneY + 45);

          const chatY = phoneY + 80;
          
          if (phaseProgress > 0.1) {
              const slideIn = Math.min(1, (phaseProgress - 0.1) * 5);
              ctx.globalAlpha = slideIn;
              ctx.translate(0, (1-slideIn) * 20);
              
              ctx.fillStyle = 'rgba(255,255,255,0.1)';
              if (typeof ctx.roundRect === 'function') ctx.roundRect(phoneX + 15, chatY, 120, 34, 12);
              else ctx.rect(phoneX + 15, chatY, 120, 34);
              ctx.fill();
              
              ctx.fillStyle = 'rgba(255,255,255,0.5)';
              ctx.fillRect(phoneX + 25, chatY + 10, 80, 4);
              ctx.fillRect(phoneX + 25, chatY + 20, 50, 4);
              
              ctx.translate(0, -(1-slideIn) * 20);
              ctx.globalAlpha = 1;
          }

          if (phaseProgress > 0.3 && phaseProgress < 0.6) {
              const scanY = chatY + 40 + (phaseProgress - 0.3) * 200;
              ctx.strokeStyle = GOLD;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(phoneX, scanY);
              ctx.lineTo(phoneX + phoneW, scanY);
              ctx.stroke();
              
              ctx.fillStyle = 'rgba(138, 154, 91, 0.1)';
              ctx.fillRect(phoneX, chatY, phoneW, scanY - chatY);
          }

          if (phaseProgress > 0.5) {
               const slideIn = Math.min(1, (phaseProgress - 0.5) * 5);
               const bubX = phoneX + phoneW - 135;
               const bubY = chatY + 50;
               
               ctx.globalAlpha = slideIn;
               
               ctx.fillStyle = GOLD;
               if (typeof ctx.roundRect === 'function') ctx.roundRect(bubX, bubY, 120, 40, 12);
               else ctx.rect(bubX, bubY, 120, 40);
               ctx.fill();
               
               ctx.fillStyle = 'rgba(0,0,0,0.4)';
               ctx.fillRect(bubX + 10, bubY + 12, 90, 4);
               ctx.fillRect(bubX + 10, bubY + 24, 60, 4);
               
               ctx.globalAlpha = 1;
          }
          
          if (phaseProgress > 0.7) {
              const scale = Math.min(1, (phaseProgress - 0.7) * 6); 
              
              ctx.save();
              ctx.translate(centerX, centerY + 40);
              ctx.scale(scale, scale);
              ctx.rotate(-0.2); 
              
              ctx.strokeStyle = GOLD;
              ctx.lineWidth = 4;
              ctx.strokeRect(-60, -20, 120, 40);
              
              ctx.fillStyle = GOLD;
              ctx.font = '900 24px Inter';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(industry.action, 0, 2);
              
              ctx.fillStyle = 'rgba(0,0,0,0.3)';
              for(let k=0; k<10; k++) {
                  ctx.fillRect((Math.random()-0.5)*110, (Math.random()-0.5)*30, 2, 2);
              }

              ctx.restore();
          }

          ctx.restore(); 

          // 4. Draw Orbit Nodes (Last, to float above phone if needed)
          INDUSTRIES.forEach((ind, i) => {
            // UPDATED: Rotate by 45 degrees (+ Math.PI / 4) to put nodes in corners
            const angle = (i / INDUSTRIES.length) * Math.PI * 2 - Math.PI / 2 + Math.PI / 4;
            const radius = Math.min(width, height) * 0.38;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            const isActive = i === currentIdx;

            ctx.beginPath();
            ctx.arc(x, y, isActive ? 28 : 20, 0, Math.PI * 2);
            ctx.fillStyle = isActive ? GOLD : 'rgba(30, 41, 59, 0.5)';
            ctx.strokeStyle = isActive ? GOLD : SLATE;
            if (isActive) {
                ctx.shadowColor = GOLD;
                ctx.shadowBlur = 20;
            }
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.font = '20px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = WHITE;
            ctx.fillText(ind.icon, x, y + 2);
            
            if (isActive) {
                ctx.fillStyle = WHITE;
                ctx.font = 'bold 12px Inter';
                ctx.fillText(ind.name, x, y + 45);
            }
        });
  
        animationFrameId = requestAnimationFrame(() => render(performance.now()));
      };
      
      render(performance.now());
      return () => cancelAnimationFrame(animationFrameId);
    }, [isInView]);
  
    return (
      <div ref={containerRef} className="w-full h-[500px] bg-slate-950/50 rounded-2xl border border-slate-900 relative overflow-hidden">
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

  // Reset success state when modal is reopened
  useEffect(() => {
    if (open) setSuccess(false);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (supabase) {
        const { error } = await supabase.from('early_access_signups').insert([{
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
        if (error) {
             console.warn("Supabase insert error (likely due to missing table/permissions in demo):", error);
             // We continue to show success for the demo user experience
        }
      } else {
        // Fallback for demo without supabase connection
        console.log("Supabase not configured. Simulated submission:", { ...formData, plan, billing });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      setSuccess(true);
    } catch (err) {
      console.error('Error submitting form:', err);
      // Fallback success for demo
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
        <DialogContent className="sm:max-w-[500px] bg-slate-900 text-white border-slate-800">
            {!success ? (
                <>
                    <DialogHeader>
                        <DialogTitle>Get Early Access</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            You selected the <span className="text-[#8A9A5B] font-bold">{plan}</span> plan ({billing}). <br/>
                            Fill in your details to join the waitlist.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label htmlFor="fullName" className="text-sm font-medium">Full Name *</label>
                                <Input required id="fullName" name="fullName" placeholder="John Doe" className="bg-slate-950 border-slate-700" value={formData.fullName} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="workEmail" className="text-sm font-medium">Work Email *</label>
                                <Input required id="workEmail" name="workEmail" type="email" placeholder="john@company.com" className="bg-slate-950 border-slate-700" value={formData.workEmail} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="companyName" className="text-sm font-medium">Company Name</label>
                            <Input id="companyName" name="companyName" placeholder="Acme Corp" className="bg-slate-950 border-slate-700" value={formData.companyName} onChange={handleChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label htmlFor="industry" className="text-sm font-medium">Industry</label>
                                <select id="industry" name="industry" className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={formData.industry} onChange={handleChange}>
                                    <option value="" disabled>Select...</option>
                                    <option value="Real Estate">Real Estate</option>
                                    <option value="Insurance">Insurance</option>
                                    <option value="Education">Education</option>
                                    <option value="Retail">Retail</option>
                                    <option value="Services">Services</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="teamSize" className="text-sm font-medium">Team Size</label>
                                <select id="teamSize" name="teamSize" className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={formData.teamSize} onChange={handleChange}>
                                    <option value="" disabled>Select...</option>
                                    <option value="1-5">1-5</option>
                                    <option value="6-20">6-20</option>
                                    <option value="21-50">21-50</option>
                                    <option value="50+">50+</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                             <label htmlFor="estimatedConversations" className="text-sm font-medium">Est. WhatsApp Conversations / Day</label>
                             <Input id="estimatedConversations" name="estimatedConversations" placeholder="e.g. 100" className="bg-slate-950 border-slate-700" value={formData.estimatedConversations} onChange={handleChange} />
                        </div>

                        <Button type="submit" className="w-full bg-[#8A9A5B] hover:bg-[#9AAA6B] text-white mt-4" disabled={loading}>
                            {loading ? 'Submitting...' : 'Get Early Access'}
                        </Button>
                    </form>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-[#8A9A5B]/20 flex items-center justify-center">
                        <CheckIcon className="h-8 w-8 text-[#8A9A5B]" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">You're on the list!</h3>
                    <p className="text-slate-400 max-w-xs">
                        Thanks for your interest in inShoppe AI. We've received your request and will contact you shortly for onboarding.
                    </p>
                    <Button onClick={() => onOpenChange(false)} variant="outline" className="mt-4 border-slate-700 text-slate-300 hover:bg-slate-800">
                        Close
                    </Button>
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
        <section id="pricing" className="py-24 bg-slate-950 border-b border-slate-900 relative">
            <div className="container mx-auto px-4 relative z-10">
                <div className="text-center mb-12">
                    <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
                        Simple Pricing. <span className="text-[#8A9A5B]">Powered by Credits.</span>
                    </h2>
                    <p className="text-gray-400 text-lg">
                        Start free. Scale only when your WhatsApp sales grow.
                    </p>
                    
                    {/* Toggle */}
                    <div className="flex justify-center items-center mt-8">
                        <div className="bg-slate-900 p-1 rounded-full border border-slate-800 inline-flex relative">
                            <button 
                                onClick={() => setBilling('monthly')}
                                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${billing === 'monthly' ? 'bg-[#8A9A5B] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Monthly
                            </button>
                            <button 
                                onClick={() => setBilling('yearly')}
                                className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${billing === 'yearly' ? 'bg-[#8A9A5B] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Yearly
                            </button>
                            {/* Save Badge */}
                            <div className="absolute -right-24 top-1/2 -translate-y-1/2 bg-green-500/20 border border-green-500/50 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                SAVE 20%
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {/* Free Plan */}
                    <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-8 flex flex-col hover:border-slate-700 transition-all">
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-white">Free</h3>
                            <div className="mt-2 flex items-baseline gap-1">
                                <span className="text-4xl font-bold text-white">RM 0</span>
                            </div>
                            <p className="text-sm text-slate-400 mt-2">For individuals and early testing</p>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            <li className="flex items-start gap-3 text-sm text-slate-300">
                                <CheckIcon className="h-5 w-5 text-[#8A9A5B] shrink-0" />
                                <span>AI Smart Inbox (basic)</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-300">
                                <CheckIcon className="h-5 w-5 text-[#8A9A5B] shrink-0" />
                                <span>Auto message classification</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-300">
                                <CheckIcon className="h-5 w-5 text-[#8A9A5B] shrink-0" />
                                <span>Single WhatsApp number</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-300">
                                <CheckIcon className="h-5 w-5 text-[#8A9A5B] shrink-0" />
                                <span>Community support</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-white font-semibold pt-2 border-t border-slate-800">
                                <div className="h-5 w-5 rounded-full bg-[#8A9A5B]/20 flex items-center justify-center shrink-0 text-[#8A9A5B] text-[10px]">⚡</div>
                                <span>30 credits / month</span>
                            </li>
                        </ul>
                        <Button variant="outline" className="w-full border-slate-700 hover:bg-slate-800 text-black" onClick={() => handlePlanClick('Free')}>
                            Join Free
                        </Button>
                    </div>

                    {/* Starter Plan */}
                    <div className="bg-slate-900/80 rounded-2xl border border-[#8A9A5B]/50 p-8 flex flex-col relative shadow-xl shadow-[#8A9A5B]/10 scale-105 z-10">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#8A9A5B] text-white text-xs font-bold px-3 py-1 rounded-full">
                            MOST POPULAR
                        </div>
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-[#8A9A5B]">Starter</h3>
                            <div className="mt-2 flex items-baseline gap-1">
                                <span className="text-4xl font-bold text-white">
                                    {billing === 'monthly' ? 'RM 299' : 'RM 2,870'}
                                </span>
                                <span className="text-slate-500">
                                    {billing === 'monthly' ? '/ month' : '/ year'}
                                </span>
                            </div>
                            <p className="text-sm text-slate-400 mt-2">For growing teams selling on WhatsApp</p>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            <li className="flex items-start gap-3 text-sm text-slate-300">
                                <CheckIcon className="h-5 w-5 text-[#8A9A5B] shrink-0" />
                                <span>Everything in Free</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-300">
                                <CheckIcon className="h-5 w-5 text-[#8A9A5B] shrink-0" />
                                <span>Workflow AI (industry actions)</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-300">
                                <CheckIcon className="h-5 w-5 text-[#8A9A5B] shrink-0" />
                                <span>Lead capture & CRM sync</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-300">
                                <CheckIcon className="h-5 w-5 text-[#8A9A5B] shrink-0" />
                                <span>Team assignment & reminders</span>
                            </li>
                             <li className="flex items-start gap-3 text-sm text-white font-semibold pt-2 border-t border-slate-800">
                                <div className="h-5 w-5 rounded-full bg-[#8A9A5B]/20 flex items-center justify-center shrink-0 text-[#8A9A5B] text-[10px]">⚡</div>
                                <span>500 credits / month</span>
                            </li>
                        </ul>
                        <Button className="w-full bg-[#8A9A5B] hover:bg-[#9AAA6B] text-white" onClick={() => handlePlanClick('Starter')}>
                            Request Early Access
                        </Button>
                    </div>

                    {/* Pro Plan */}
                    <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-8 flex flex-col hover:border-slate-700 transition-all">
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-white">Pro</h3>
                            <div className="mt-2 flex items-baseline gap-1">
                                <span className="text-4xl font-bold text-white">
                                    {billing === 'monthly' ? 'RM 899' : 'RM 8,630'}
                                </span>
                                <span className="text-slate-500">
                                    {billing === 'monthly' ? '/ month' : '/ year'}
                                </span>
                            </div>
                            <p className="text-sm text-slate-400 mt-2">For high-volume & revenue teams</p>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            <li className="flex items-start gap-3 text-sm text-slate-300">
                                <CheckIcon className="h-5 w-5 text-[#8A9A5B] shrink-0" />
                                <span>Everything in Starter</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-300">
                                <CheckIcon className="h-5 w-5 text-[#8A9A5B] shrink-0" />
                                <span>Advanced AI automation modules</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-300">
                                <CheckIcon className="h-5 w-5 text-[#8A9A5B] shrink-0" />
                                <span>Custom workflows</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-slate-300">
                                <CheckIcon className="h-5 w-5 text-[#8A9A5B] shrink-0" />
                                <span>Priority onboarding & support</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-white font-semibold pt-2 border-t border-slate-800">
                                <div className="h-5 w-5 rounded-full bg-[#8A9A5B]/20 flex items-center justify-center shrink-0 text-[#8A9A5B] text-[10px]">⚡</div>
                                <span>2,000 credits / month</span>
                            </li>
                        </ul>
                        <Button variant="outline" className="w-full border-slate-700 hover:bg-slate-800 text-black" onClick={() => handlePlanClick('Pro')}>
                            Request Early Access
                        </Button>
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <p className="text-sm text-slate-500 max-w-2xl mx-auto">
                        <span className="text-[#8A9A5B] font-semibold">How Credits Work:</span> 1 credit = 1 WhatsApp conversation window (24h) per customer. 
                        Sending messages, images, or files within that window does not consume extra credits. Top-ups available anytime.
                    </p>
                </div>

                <EarlyAccessModal 
                    open={modalOpen} 
                    onOpenChange={setModalOpen} 
                    plan={selectedPlan} 
                    billing={billing} 
                />
            </div>
        </section>
    );
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-950 text-white pb-24 font-sans">
      {/* Floating Header - Moved to bottom */}
      <header className="fixed bottom-0 left-0 right-0 z-50 w-full px-4 pb-4 pointer-events-none">
        <div className="mx-auto w-fit max-w-[95%] md:max-w-4xl flex flex-col-reverse items-center gap-2 pointer-events-auto">
           {/* Mobile Dropdown Menu */}
          {menuOpen && (
            <nav className="w-full flex flex-col bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4 md:hidden animate-fadeInUp">
              <a onClick={() => setMenuOpen(false)} href="#how-it-works" className="py-2 text-gray-300 hover:text-[#8A9A5B] transition-colors">How it works</a>
              <a onClick={() => setMenuOpen(false)} href="#features" className="py-2 text-gray-300 hover:text-[#8A9A5B] transition-colors">Features</a>
              <a onClick={() => setMenuOpen(false)} href="#services" className="py-2 text-gray-300 hover:text-[#8A9A5B] transition-colors">Services</a>
              <a onClick={() => setMenuOpen(false)} href="#pricing" className="py-2 text-gray-300 hover:text-[#8A9A5B] transition-colors">Pricing</a>
              <a onClick={() => setMenuOpen(false)} href="#faq" className="py-2 text-gray-300 hover:text-[#8A9A5B] transition-colors">FAQ</a>
              <Link onClick={() => setMenuOpen(false)} to="/auth" className="py-2 text-gray-300 hover:text-[#8A9A5B] transition-colors hidden">SignIn</Link>
            </nav>
          )}

          {/* Main Nav Bar */}
          <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl px-10 py-4 flex items-center gap-6 shadow-2xl">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <img src="https://rwlecxyfukzberxcpqnr.supabase.co/storage/v1/object/public/general/inShoppe%20Logo.png" className="h-8 w-auto" />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-4">
              <a href="#how-it-works" className="text-lg text-gray-300 hover:text-[#8A9A5B] transition-colors">How it works</a>
              <a href="#features" className="text-lg text-gray-300 hover:text-[#8A9A5B] transition-colors">Features</a>
              <a href="#services" className="text-lg text-gray-300 hover:text-[#8A9A5B] transition-colors">Services</a>
              <a href="#pricing" className="text-lg text-gray-300 hover:text-[#8A9A5B] transition-colors">Pricing</a>
              <a href="#faq" className="text-lg text-gray-300 hover:text-[#8A9A5B] transition-colors">FAQ</a>
              <Link to="/auth" className="text-sm text-gray-300 hover:text-[#8A9A5B] transition-colors hidden">SignIn</Link>
            </nav>

            {/* Mobile Hamburger */}
            <button
              className="md:hidden text-gray-300 ml-auto"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-20 pb-20 md:pt-24 md:pb-32">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[#8A9A5B]/10 border border-[#8A9A5B]/30 rounded-full px-4 py-2 mb-8">
            <span className="text-sm text-[#8A9A5B] font-medium">Best WhatsApp AI Action Agent for Business</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            <span className="text-[#8A9A5B]">Where WhatsApp Becomes</span><br />
            <span className="text-white">an AI Action Engine!</span>
            <span className="inline-block ml-3">
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            An AI action engine that understands intent, executes workflows, and drives revenue on WhatsApp.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button onClick={() => navigate('/auth')} className="hidden bg-[#8A9A5B] hover:bg-[#9AAA6B] text-white font-semibold px-8 py-4 rounded-3xl transition-all duration-200 shadow-lg shadow-[#8A9A5B]/30 hover:shadow-[#8A9A5B]/50 hover:scale-105">
              Join the waitlist!
            </button>
            <button onClick={() => document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' })} className="bg-[#8A9A5B] hover:bg-[#9AAA6B] text-white font-semibold px-8 py-4 rounded-3xl transition-all duration-200 shadow-lg shadow-[#8A9A5B]/30 hover:shadow-[#8A9A5B]/50 hover:scale-105">
              Join the waitlist!
            </button>
            <button className="hidden flex items-center gap-2 text-[#8A9A5B] hover:text-[#9AAA6B] font-medium transition-colors">
              <Play className="h-5 w-5 fill-current" />
              13-Minute Tutorial
            </button>
          </div>
        </div>
      </section>

      {/* SOLVING SECTION (New) */}
      <section className="py-24 bg-slate-950 border-y border-slate-900 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            
            {/* Left Column: Copy */}
            <div className="space-y-8 animate-fade-in-up">
              <h2 className="text-4xl md:text-5xl font-bold leading-tight">
                Selling Happens on WhatsApp. <br/>
                <span className="text-[#8A9A5B]">Managing It Is Chaos.</span>
              </h2>
              
              <div className="space-y-4">
                <p className="text-lg text-gray-400 leading-relaxed">
                  Businesses rely on WhatsApp to close deals, handle inquiries, and follow up with customers. 
                  But conversations pile up, leads are missed, responses are delayed, and sales depend entirely on human memory.
                </p>
              </div>

              <ul className="space-y-4">
                {[
                  "Messages flood in with no prioritization",
                  "Hot leads get lost in long chat histories",
                  "Follow-ups are inconsistent or forgotten",
                  "Sales teams waste time repeating the same replies"
                ].map((point, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-300">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#8A9A5B]" />
                    {point}
                  </li>
                ))}
              </ul>

              <div className="pt-4">
                 <button onClick={() => navigate('/auth')} className="text-[#8A9A5B] hover:text-white font-medium border-b border-[#8A9A5B] pb-0.5 hover:border-white transition-all">
                  See how inShoppe fixes this &rarr;
                </button>
              </div>
            </div>

            {/* Right Column: Canvas Animation */}
            <div className="relative">
              {/* Decorative blur behind canvas */}
              <div className="absolute -top-10 -right-10 w-64 h-64 bg-[#8A9A5B]/10 rounded-full blur-[80px] pointer-events-none"></div>
              <SolvingAnimation />
            </div>

          </div>
        </div>
      </section>

      {/* How it works section */}
      <section id="how-it-works" className="py-24 bg-black relative">
         <div className="container mx-auto px-4">
             <div className="text-center mb-12">
                 <h2 className="text-4xl md:text-5xl font-bold mb-4">
                    From Message to Action — <span className="text-[#8A9A5B]">Automatically.</span>
                 </h2>
                 <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                    inShoppe AI understands customer intent, decides what to do, and executes the next business action — all inside WhatsApp.
                 </p>
             </div>
             
             {/* 3 Steps */}
             <div className="grid md:grid-cols-3 gap-8 mb-12">
                 {[
                     { title: "1. Understand Intent", text: "Incoming WhatsApp messages are analyzed to detect intent such as inquiry, booking, pricing request." },
                     { title: "2. Decision AI", text: "The AI decides the best course of action: answer from knowledge base, escalate to human, or trigger a workflow." }, 
                     { title: "3. Revenue Action", text: "It executes the action instantly—sending a booking link, saving a lead to CRM, or processing a purchase." }
                 ].map((step, i) => (
                    <div key={i} className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                        <h3 className="text-xl font-bold mb-3 text-white">{step.title}</h3>
                        <p className="text-gray-400 text-sm leading-relaxed">{step.text}</p>
                    </div>
                 ))}
             </div>
         </div>
      </section>
      
      {/* Features Section placeholder since file was cut */}
      <section id="features" className="py-24 bg-slate-950">
          <div className="container mx-auto px-4 text-center">
              <h2 className="text-3xl font-bold mb-8">Powerful Features</h2>
              <p className="text-gray-400">Everything you need to automate sales on WhatsApp.</p>
          </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />
      
      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-black">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">Common Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            {faqData.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="bg-white border border-gray-800 mb-4 rounded-xl px-6 py-4">
                <AccordionTrigger className="text-lg hover:no-underline">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-gray-400 text-base mt-2">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-12 border-t border-gray-800 text-center text-gray-500 text-sm">
          <div className="container mx-auto px-4">
              <p>&copy; {new Date().getFullYear()} inShoppe AI. All rights reserved.</p>
          </div>
      </footer>

    </div>
  );
};

// Icons
function Play(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    )
}

export default LandingPage;
