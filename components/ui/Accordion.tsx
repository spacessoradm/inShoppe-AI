import React, { useState, createContext, useContext } from 'react';
import { cn } from '../../lib/utils';

// --- Contexts ---

interface AccordionContextType {
  openItem: string | null;
  setOpenItem: (value: string | null) => void;
  collapsible: boolean;
}

const AccordionContext = createContext<AccordionContextType | undefined>(undefined);

const useAccordion = () => {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error('useAccordion must be used within an <Accordion>');
  }
  return context;
};

const AccordionItemContext = createContext<string | undefined>(undefined);

const useAccordionItemContext = () => {
  const context = useContext(AccordionItemContext);
  if (context === undefined) {
    throw new Error('AccordionItem components must be used within an <AccordionItem>');
  }
  return context;
};

// --- Components ---

const Accordion = ({ children, type, collapsible = false, className, ...props }: { children: React.ReactNode; type: 'single' | 'multiple', collapsible?: boolean } & React.HTMLAttributes<HTMLDivElement>) => {
  const [openItem, setOpenItem] = useState<string | null>(null);

  return (
    <AccordionContext.Provider value={{ openItem, setOpenItem, collapsible }}>
      <div className={cn("space-y-5 divide-y divide-gray-800", className)} {...props}>{children}</div>
    </AccordionContext.Provider>
  );
};

const AccordionItem = React.forwardRef<
  HTMLDivElement,
  { value: string } & React.HTMLAttributes<HTMLDivElement>
>(({ children, value, className, ...props }, ref) => {
  return (
    <AccordionItemContext.Provider value={value}>
      <div
        ref={ref}
        className={cn(
          "rounded-2xl bg-[#fff] px-6 py-6", // <— screenshot look
          className
        )}
        {...props}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
});


AccordionItem.displayName = 'AccordionItem';

const AccordionTrigger = React.forwardRef<HTMLButtonElement, React.HTMLAttributes<HTMLButtonElement>>(({ children, className, ...props }, ref) => {
  const { openItem, setOpenItem, collapsible } = useAccordion();
  const value = useAccordionItemContext();
  const isOpen = openItem === value;

  const handleClick = () => {
    if (isOpen) {
      if (collapsible) {
        setOpenItem(null);
      }
    } else {
      setOpenItem(value);
    }
  };

  return (
      <button
        ref={ref}
        onClick={handleClick}
        aria-expanded={isOpen}
        data-state={isOpen ? 'open' : 'closed'}
        className={cn(
          "flex w-full items-center justify-between text-left font-medium transition-all text-base md:text-lg group",
          isOpen ? "text-[#8A9A5B]" : "text-[#000000] hover:text-[#8A9A5B]",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className={cn("h-5 w-5 shrink-0 text-gray-500 transition-transform duration-300 group-hover:text-[#8A9A5B]", isOpen && "rotate-180 text-[#8A9A5B]")} />
      </button>
  );
});
AccordionTrigger.displayName = 'AccordionTrigger';

const AccordionContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ children, className, ...props }, ref) => {
    const { openItem } = useAccordion();
    const value = useAccordionItemContext();
    const isOpen = openItem === value;

    return (
        <div
            ref={ref}
            className={cn(
                "grid overflow-hidden transition-all duration-300 ease-in-out",
                isOpen ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0 mt-0"
            )}
            {...props}
        >
            <div className="overflow-hidden">
                <div className={cn("text-gray-400 leading-relaxed", className)}>
                    {children}
                </div>
            </div>
        </div>
    );
});
AccordionContent.displayName = 'AccordionContent';


function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
};