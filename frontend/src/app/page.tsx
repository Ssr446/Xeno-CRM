"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, BarChart2, Send, Play, RefreshCcw, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Users, Settings, Zap, Target, Mailbox, Activity, ShoppingCart, Megaphone, Cloud, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import styles from "./page.module.css";

type Message = {
  id: string;
  role: "user" | "ai";
  content: string;
  preview?: CampaignPreview;
};

type CampaignPreview = {
  audienceFilter: string;
  messageDraft: string;
  channel: string;
  audienceSize: number;
  audienceIds: string[];
};

type CampaignStats = {
  id: string;
  name: string;
  status: string;
  audienceSize: number;
  stats: Record<string, number>;
};

// Mock Activity Feed Data
const initialActivities = [
  { id: 1, text: "System initialized. Connections verified.", type: "info", time: "Just now" },
  { id: 2, text: "Shopify customer sync completed (24ms)", type: "success", time: "2m ago" },
  { id: 3, text: "Meta Ads audience matching updated", type: "success", time: "15m ago" },
  { id: 4, text: "Klaviyo API rate limit warning", type: "warning", time: "1h ago" },
];

export default function Home() {
  const [introState, setIntroState] = useState<'loading' | 'expanding' | 'flashing' | 'done'>('loading');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignStats[]>([]);
  const [activities, setActivities] = useState(initialActivities);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [integrations, setIntegrations] = useState([
    { id: 'shopify', name: 'Shopify', desc: 'Sync customer & order data', connected: true, icon: ShoppingCart },
    { id: 'klaviyo', name: 'Klaviyo', desc: 'Email marketing engine', connected: false, icon: Mailbox },
    { id: 'meta', name: 'Meta Ads', desc: 'Custom audience syncing', connected: true, icon: Megaphone },
    { id: 'salesforce', name: 'Salesforce', desc: 'B2B CRM Sync', connected: false, icon: Cloud },
  ]);

  // Cinematic Sequence Logic
  useEffect(() => {
    const runSequence = async () => {
      await new Promise(r => setTimeout(r, 1500)); // Phase 1: Loading
      setIntroState('expanding');
      await new Promise(r => setTimeout(r, 1800)); // Phase 2: Majestic slow scale
      setIntroState('flashing');
      await new Promise(r => setTimeout(r, 1400)); // Phase 3: Slow burst of light
      setIntroState('done'); // Phase 4: Reveal and fly to top
    };
    runSequence();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement).blur();
        }
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
        if (activeTab !== 'chat') setActiveTab('chat');
      }
      if (e.key === '[') {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }
      if (e.key === ']') {
        e.preventDefault();
        setIsActivityOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    target.style.setProperty("--mouse-x", `${x}px`);
    target.style.setProperty("--mouse-y", `${y}px`);
  };

  const fetchCampaigns = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/campaigns");
      const data = await res.json();
      setCampaigns(data);
    } catch (err) {
      console.error("Failed to fetch campaigns");
    }
  };

  useEffect(() => {
    if (introState !== 'done') return;
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 3000);
    return () => clearInterval(interval);
  }, [introState]);

  const handleSendChat = async (overrideInput?: string) => {
    const promptText = overrideInput || input;
    if (!promptText.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: promptText };
    setMessages((prev) => [...prev, userMsg]);
    if (!overrideInput) setInput("");
    setIsLoading(true);
    
    // Add activity log
    setActivities(prev => [{ id: Date.now(), text: `Querying database: "${promptText.substring(0, 20)}..."`, type: "info", time: "Just now" }, ...prev]);

    try {
      const res = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMsg.content }),
      });
      const data = await res.json();

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "ai",
            content: "Query executed.",
            preview: data.preview,
          },
        ]);
        setActivities(prev => [{ id: Date.now(), text: `AI Segment returned ${data.preview.audienceSize} matches.`, type: "success", time: "Just now" }, ...prev]);
      } else {
        setMessages((prev) => [...prev, { id: Date.now().toString(), role: "ai", content: "Error: " + data.error }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: "ai", content: "Network error." }]);
    }
    setIsLoading(false);
  };

  const handleLaunchCampaign = async (preview: CampaignPreview, msgId: string) => {
    try {
      const res = await fetch("http://localhost:3001/api/campaign/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Campaign targeting ${preview.audienceFilter}`,
          messageContent: preview.messageDraft,
          channel: preview.channel,
          audienceIds: preview.audienceIds,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), role: "ai", content: `Enqueued ${preview.audienceSize} messages.` },
        ]);
        setActiveTab("campaigns");
        fetchCampaigns();
        setActivities(prev => [{ id: Date.now(), text: `Campaign Launched (${preview.audienceSize} targets)`, type: "success", time: "Just now" }, ...prev]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleIntegration = (id: string) => {
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, connected: !i.connected } : i));
  };

  const TypingIndicator = () => (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '24px' }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={{ width: '4px', height: '4px', background: '#888', borderRadius: '50%' }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {introState !== 'done' && (
          <motion.div 
            className={styles.splashScreen}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          >
            <div className={styles.splashContent}>
              <motion.div 
                className={styles.splashLogoContainer}
                style={{ display: 'flex', alignItems: 'center', gap: '24px' }}
              >
                <div style={{position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                  <motion.div 
                    layoutId="sharedLogo"
                    className={styles.brandLogo} 
                    animate={{ scale: (introState === 'expanding' || introState === 'flashing') ? 2.5 : 1 }}
                    transition={{ duration: 1.8, ease: "easeInOut" }}
                  />
                  
                  {/* Majestic Smooth Light Burst */}
                  <AnimatePresence>
                    {introState === 'flashing' && (
                       <motion.div 
                         className={styles.flashGlow}
                         initial={{ opacity: 0, scale: 0.2 }}
                         animate={{ opacity: 1, scale: 2 }}
                         exit={{ opacity: 0 }}
                         transition={{ duration: 1.4, ease: "easeInOut" }}
                       />
                    )}
                  </AnimatePresence>
                </div>

                <AnimatePresence>
                  {introState === 'loading' && (
                    <motion.div 
                      className={styles.splashLetter}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.4 }}
                    >
                      xeno
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
              
              <AnimatePresence>
                {introState === 'loading' && (
                  <motion.div className={styles.loadingBarContainer} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                    <motion.div 
                      className={styles.loadingBarProgress}
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 1.2, ease: "easeInOut" }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>



      {introState === 'done' && (
        <motion.div 
          className={styles.layout}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {/* Left Sidebar */}
          <div className={`${styles.sidebar} ${!isSidebarOpen ? styles.sidebarClosed : ''}`}>
            <div className={styles.sidebarHeader}>
              <button className={styles.toggleBtn} onClick={() => setIsSidebarOpen(false)}>
                <PanelLeftClose size={16} />
                <span className={styles.kbdHint}>[</span>
              </button>
            </div>
            
            <div className={styles.navMenu}>
              <div className={styles.navGroup}>Workspace</div>
              <div 
                className={`${styles.navItem} ${activeTab === 'chat' ? styles.active : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                <Terminal size={14} /> Command Interface
              </div>
              <div 
                className={`${styles.navItem} ${activeTab === 'campaigns' ? styles.active : ''}`}
                onClick={() => setActiveTab('campaigns')}
              >
                <BarChart2 size={14} /> Analytics
              </div>
              
              <div className={styles.navGroup}>Data</div>
              <div 
                className={`${styles.navItem} ${activeTab === 'customers' ? styles.active : ''}`}
                onClick={() => setActiveTab('customers')}
              >
                <Users size={14} /> Customers
              </div>
              
              <div className={styles.navGroup}>Platform</div>
              <div 
                className={`${styles.navItem} ${activeTab === 'integrations' ? styles.active : ''}`}
                onClick={() => setActiveTab('integrations')}
              >
                <Zap size={14} /> Integrations
              </div>
              <div 
                className={`${styles.navItem} ${activeTab === 'settings' ? styles.active : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <Settings size={14} /> Settings
              </div>
            </div>
          </div>

          {/* Right Sidebar (Activity Feed) */}
          <div className={`${styles.rightSidebar} ${!isActivityOpen ? styles.rightSidebarClosed : ''}`}>
            <div className={styles.rightSidebarTitle}>
              <button className={styles.toggleBtn} onClick={() => setIsActivityOpen(false)} style={{ float: 'right', marginTop: '-4px', marginRight: '-8px' }}>
                <PanelRightClose size={16} />
                <span className={styles.kbdHint}>]</span>
              </button>
              <Activity size={12} style={{ display: 'inline', marginRight: '6px', marginBottom: '-2px' }} />
              Live Activity
            </div>
            <div className={styles.activityFeed}>
              <AnimatePresence>
                {activities.map((act) => (
                  <motion.div 
                    key={act.id} 
                    className={styles.activityItem}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <div className={`${styles.activityDot} ${styles[act.type]}`} />
                    <div className={styles.activityContent}>
                      <div className={styles.activityText}>{act.text}</div>
                      <div className={styles.activityTime}>{act.time}</div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className={`${styles.mainContentWrapper} ${!isSidebarOpen ? styles.mainContentWrapperExpanded : ''}`}>
            <div className={styles.mainContent}>
              
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <div className={styles.topCenterHeader} style={{ position: 'relative', top: 'auto', left: 'auto', transform: 'none' }}>
                  <motion.div layoutId="sharedLogo" className={`${styles.brandLogo} ${styles.brandLogoSmall}`} />
                  <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.8}} className={styles.logo}>xeno</motion.div>
                </div>
              </div>

              <div className={styles.topHeader}>
                {!isSidebarOpen && (
                  <button className={styles.toggleBtn} onClick={() => setIsSidebarOpen(true)}>
                    <PanelLeftOpen size={16} />
                    <span className={styles.kbdHint}>[</span>
                  </button>
                )}
                <h1 style={{ fontSize: '1.1rem', fontWeight: 500, letterSpacing: '-0.5px' }}>
                  {activeTab === 'chat' ? 'Command Interface' : 
                   activeTab === 'campaigns' ? 'Analytics' : 
                   activeTab === 'customers' ? 'Customer Directory' : 
                   activeTab === 'integrations' ? 'Integrations' : 'Settings'}
                </h1>
                <div style={{ flex: 1 }} />
                {!isActivityOpen && (
                  <button className={styles.toggleBtn} onClick={() => setIsActivityOpen(true)}>
                    <span className={styles.kbdHint}>]</span>
                    <PanelRightOpen size={16} />
                  </button>
                )}
              </div>

              {activeTab === 'chat' && (
                <>
                  <div className={styles.kpiRow}>
                    <div className={styles.kpiCard}>
                      <div className={styles.kpiLabel}><Users size={12} /> Total Audience</div>
                      <div className={styles.kpiValue}>1,000</div>
                    </div>
                    <div className={styles.kpiCard}>
                      <div className={styles.kpiLabel}><Activity size={12} /> Active Campaigns</div>
                      <div className={styles.kpiValue}>{campaigns.length}</div>
                    </div>
                    <div className={styles.kpiCard}>
                      <div className={styles.kpiLabel}><Mailbox size={12} /> Delivery Rate</div>
                      <div className={styles.kpiValue}>91.4%</div>
                    </div>
                  </div>

                  <div className={styles.chatContainer}>
                    <div className={styles.chatMessages}>
                      <AnimatePresence>
                        {messages.length === 0 && !isLoading && (
                          <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            style={{ textAlign: 'center', color: '#666', marginTop: '20px' }}
                          >
                            <Terminal size={32} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                            <p style={{fontSize: '0.85rem'}}>System ready. Press <span className={styles.kbdHint}>/</span> to focus command.</p>
                          </motion.div>
                        )}

                        {messages.map((m) => (
                          <motion.div 
                            key={m.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`${styles.message} ${styles[m.role]}`}
                          >
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                              {m.role === 'ai' ? <Terminal size={16} color="#888" style={{marginTop: '2px'}} /> : null}
                              <div style={{ flex: 1 }}>{m.content}</div>
                            </div>
                            
                            {m.preview && (
                              <motion.div 
                                className={styles.previewCard}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.1 }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <div style={{color: '#666', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px'}}>Segment</div>
                                    <div style={{fontWeight: 500, fontSize: '0.9rem'}}>{m.preview.audienceFilter}</div>
                                  </div>
                                  <div style={{textAlign: 'right'}}>
                                    <div style={{color: '#666', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px'}}>Matched</div>
                                    <div className={styles.previewStat}>{m.preview.audienceSize}</div>
                                  </div>
                                </div>
                                
                                <div style={{background: '#000', padding: '16px', borderRadius: '4px', border: '1px solid #111'}}>
                                  <div style={{color: '#666', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px'}}>Payload: {m.preview.channel}</div>
                                  <div style={{color: '#ccc', fontSize: '0.9rem'}}>{m.preview.messageDraft}</div>
                                </div>
                                
                                <div className={styles.previewActions}>
                                  <button className="btnPrimary" onClick={() => handleLaunchCampaign(m.preview!, m.id)}>
                                    <Play size={14} fill="currentColor" /> Execute
                                  </button>
                                  <button className="btnSecondary" onClick={() => handleSendChat("Revise the payload to be more concise.")}>
                                    <RefreshCcw size={14} /> Rewrite
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      
                      {isLoading && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`${styles.message} ${styles.ai}`}
                        >
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <Terminal size={16} color="#888" />
                            <TypingIndicator />
                          </div>
                        </motion.div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {messages.length === 0 && !isLoading && (
                      <div className={styles.quickActionsContainer}>
                        <div className={styles.quickActionCard} onClick={() => handleSendChat("Find customers who haven't ordered in 6 months and draft an SMS.")}>
                          <div className={styles.quickActionTitle}><Target size={14} /> Re-engage Dormant</div>
                          <div style={{fontSize: '0.75rem', color: '#666'}}>Find users inactive {'>'} 6 months</div>
                        </div>
                        <div className={styles.quickActionCard} onClick={() => handleSendChat("Target high spenders over $500 with a VIP discount code.")}>
                          <div className={styles.quickActionTitle}><Zap size={14} /> VIP Segment</div>
                          <div style={{fontSize: '0.75rem', color: '#666'}}>Reward {'>'} $500 lifetime spend</div>
                        </div>
                        <div className={styles.quickActionCard} onClick={() => handleSendChat("Draft a follow-up email for customers who abandoned carts today.")}>
                          <div className={styles.quickActionTitle}><ShoppingCart size={14} /> Cart Recovery</div>
                          <div style={{fontSize: '0.75rem', color: '#666'}}>Target today's abandoned checkouts</div>
                        </div>
                        <div className={styles.quickActionCard} onClick={() => handleSendChat("Segment users who bought the summer collection for an upsell.")}>
                          <div className={styles.quickActionTitle}><Users size={14} /> Product Upsell</div>
                          <div style={{fontSize: '0.75rem', color: '#666'}}>Cross-sell based on past purchases</div>
                        </div>
                      </div>
                    )}

                    <div className={styles.chatInputWrapper}>
                      <input 
                        ref={inputRef}
                        type="text" 
                        style={{ border: 'none', background: 'transparent', flex: 1, outline: 'none', color: '#fff', fontSize: '0.9rem' }}
                        placeholder="Command or query..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {input.length === 0 && <span className={styles.kbdHint}>/</span>}
                        <button className="btnPrimary" style={{ padding: '6px 10px', borderRadius: '4px' }} onClick={() => handleSendChat()}>
                          <Send size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'campaigns' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.campaignsDashboard} style={{ paddingBottom: '120px' }}>
                  <div className={styles.dashboardHeader}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 500 }}>Live Campaign Funnels</h2>
                    <p style={{ color: '#888', fontSize: '0.85rem' }}>Real-time delivery and engagement insights</p>
                  </div>
                  
                  {campaigns.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#666', border: '1px dashed #333', borderRadius: '8px' }}>
                      <Activity size={32} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                      <p>No active campaigns yet. Ask the AI to launch one.</p>
                    </div>
                  ) : (
                    <div className={styles.campaignGrid}>
                      <AnimatePresence>
                        {campaigns.map((camp) => {
                          const total = camp.audienceSize || 1;
                          const delivered = camp.stats['DELIVERED'] || 0;
                          const opened = camp.stats['OPENED'] || 0;
                          const clicked = camp.stats['CLICKED'] || 0;
                          const failed = camp.stats['FAILED'] || 0;
                          
                          return (
                            <motion.div 
                              key={camp.id} 
                              className={styles.campaignCard}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              layout
                            >
                              <div className={styles.cardHeader}>
                                <div>
                                  <h3 style={{ fontSize: '1rem', fontWeight: 500 }}>{camp.name}</h3>
                                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                    <span className="statusPill success">{camp.channel}</span>
                                    <span className="statusPill" style={{background: '#111', color: '#888'}}>{total} Targets</span>
                                  </div>
                                </div>
                                <div className={styles.statusIndicator}>
                                  {camp.status === 'SENDING' ? <RefreshCcw size={14} className={styles.spin} /> : <CheckCircle2 size={14} color="#4ade80" />}
                                </div>
                              </div>
                              
                              <div className={styles.funnelContainer}>
                                <div className={styles.funnelRow}>
                                  <div className={styles.funnelLabel}>Sent</div>
                                  <div className={styles.funnelBarBg}>
                                    <motion.div className={styles.funnelBarFill} style={{background: '#444'}} initial={{width:0}} animate={{width: '100%'}} />
                                  </div>
                                  <div className={styles.funnelValue}>{total}</div>
                                </div>
                                <div className={styles.funnelRow}>
                                  <div className={styles.funnelLabel}>Delivered</div>
                                  <div className={styles.funnelBarBg}>
                                    <motion.div className={styles.funnelBarFill} style={{background: '#3b82f6'}} initial={{width:0}} animate={{width: `${Math.min(100, (delivered/total)*100)}%`}} />
                                  </div>
                                  <div className={styles.funnelValue}>{delivered}</div>
                                </div>
                                <div className={styles.funnelRow}>
                                  <div className={styles.funnelLabel}>Opened</div>
                                  <div className={styles.funnelBarBg}>
                                    <motion.div className={styles.funnelBarFill} style={{background: '#8b5cf6'}} initial={{width:0}} animate={{width: `${Math.min(100, (opened/total)*100)}%`}} />
                                  </div>
                                  <div className={styles.funnelValue}>{opened}</div>
                                </div>
                                <div className={styles.funnelRow}>
                                  <div className={styles.funnelLabel}>Clicked</div>
                                  <div className={styles.funnelBarBg}>
                                    <motion.div className={styles.funnelBarFill} style={{background: '#10b981'}} initial={{width:0}} animate={{width: `${Math.min(100, (clicked/total)*100)}%`}} />
                                  </div>
                                  <div className={styles.funnelValue}>{clicked}</div>
                                </div>
                              </div>
                              
                              {failed > 0 && (
                                <div style={{ marginTop: '16px', fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <AlertCircle size={12} /> {failed} deliveries failed
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'customers' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="glassPanel">
                    <div className="tableContainer">
                      <table>
                        <thead>
                          <tr>
                            <th>Customer Name</th>
                            <th>Email Address</th>
                            <th>Lifetime Spend</th>
                            <th>Last Active</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Sarah Jenkins</td>
                            <td style={{color: 'var(--text-secondary)'}}>sarah.j@example.com</td>
                            <td>$1,240.00</td>
                            <td style={{color: 'var(--text-secondary)'}}>2 days ago</td>
                            <td><div className="statusPill success">VIP</div></td>
                          </tr>
                          <tr>
                            <td>Michael Chen</td>
                            <td style={{color: 'var(--text-secondary)'}}>m.chen88@example.com</td>
                            <td>$450.00</td>
                            <td style={{color: 'var(--text-secondary)'}}>3 weeks ago</td>
                            <td><div className="statusPill warning">Active</div></td>
                          </tr>
                          <tr>
                            <td>Emma Watson</td>
                            <td style={{color: 'var(--text-secondary)'}}>emma.w@example.com</td>
                            <td>$89.00</td>
                            <td style={{color: 'var(--text-secondary)'}}>6 months ago</td>
                            <td><div className="statusPill danger">Dormant</div></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'integrations' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className={styles.gridContainer}>
                    {integrations.map((app) => (
                      <div key={app.id} className={styles.hoverCard} onMouseMove={handleMouseMove}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start' }}>
                          <div className={styles.appIcon}>
                            <app.icon size={16} color="#fff" />
                          </div>
                          <div 
                            className={`${styles.toggleSwitch} ${app.connected ? styles.on : ''}`}
                            onClick={() => toggleIntegration(app.id)}
                          >
                            <div className={styles.toggleKnob} />
                          </div>
                        </div>
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>{app.name}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>{app.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'settings' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="glassPanel">
                    <div className={styles.settingsForm}>
                      
                      <div className={styles.settingGroup}>
                        <div className={styles.settingLabel}>OpenAI API Key</div>
                        <div className={styles.settingDesc}>Used for natural language query generation.</div>
                        <input type="password" placeholder="sk-..." className="inputField" defaultValue="sk-proj-xeno-demo-key" style={{ marginTop: '8px' }} />
                      </div>

                      <div style={{ height: '1px', background: 'var(--border-glass)', margin: '16px 0' }} />

                      <div className={styles.settingGroup}>
                        <div className={styles.settingLabel}>Automatic Campaign Execution</div>
                        <div className={styles.settingDesc}>If enabled, campaigns will launch without requiring manual review.</div>
                        <div style={{ marginTop: '8px' }} className={`${styles.toggleSwitch}`}>
                          <div className={styles.toggleKnob} />
                        </div>
                      </div>

                      <div style={{ height: '1px', background: 'var(--border-glass)', margin: '16px 0' }} />

                      <div className={styles.settingGroup}>
                        <div className={styles.settingLabel}>Data Retention</div>
                        <div className={styles.settingDesc}>How long to store campaign analytics history.</div>
                        <select className="inputField" style={{ marginTop: '8px', appearance: 'none' }}>
                          <option>90 Days</option>
                          <option>1 Year</option>
                          <option>Forever</option>
                        </select>
                      </div>

                      <div style={{ marginTop: '16px' }}>
                        <button className="btnPrimary">Save Preferences</button>
                      </div>

                    </div>
                  </div>
                </motion.div>
              )}

            </div>
          </div>
        </motion.div>
      )}
    </>
  );
}
