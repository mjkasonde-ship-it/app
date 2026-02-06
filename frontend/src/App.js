import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Play, X, ChevronLeft, ChevronRight, CheckCircle, FileText, BarChart3, Shield, Bell, Users } from "lucide-react";

// Pages
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import ComplianceMatrix from "./pages/ComplianceMatrix";
import AdminConsole from "./pages/AdminConsole";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Context for global state
export const AppContext = {
  API,
  BACKEND_URL
};

// Demo Modal Component
const DEMO_SLIDES = [
  {
    id: 1,
    title: "Quick & Easy Onboarding",
    description: "Get started in minutes with our guided 4-step onboarding. Simply enter your company details, select your sector, and we'll automatically load all relevant compliance obligations for your industry.",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80",
    icon: Users,
    features: ["Company profile setup", "Sector-specific regulations", "Automatic obligation loading"]
  },
  {
    id: 2,
    title: "Compliance Matrix & Timeline",
    description: "View all your regulatory obligations in one place. Switch between table view for detailed information or Gantt chart for timeline visualization. Never miss a deadline again.",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
    icon: FileText,
    features: ["Table view with filters", "Gantt timeline visualization", "Severity-based prioritization"]
  },
  {
    id: 3,
    title: "AI-Powered Legal Summaries",
    description: "Complex legal jargon simplified. Our AI assistant, powered by Claude, provides plain-English explanations of statutes and obligations, verified by legal professionals.",
    image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80",
    icon: Shield,
    features: ["Plain English explanations", "Key action points", "Lawyer-verified summaries"]
  },
  {
    id: 4,
    title: "Smart Alerts & Notifications",
    description: "Stay ahead of deadlines with automated email reminders. Configure notification preferences and never face penalties for missed compliance deadlines.",
    image: "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=800&q=80",
    icon: Bell,
    features: ["Email deadline reminders", "Custom notification rules", "Critical alert escalation"]
  },
  {
    id: 5,
    title: "Powerful Analytics Dashboard",
    description: "Track your compliance score, monitor progress across categories, and generate reports for stakeholders. Full visibility into your regulatory status at a glance.",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    icon: BarChart3,
    features: ["Compliance score tracking", "Category breakdowns", "Export-ready reports"]
  }
];

const DemoModal = ({ isOpen, onClose, onGetStarted }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      setCurrentSlide(0);
      return;
    }
    
    if (!isAutoPlaying) return;
    
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % DEMO_SLIDES.length);
    }, 6000);
    
    return () => clearInterval(timer);
  }, [isOpen, isAutoPlaying]);

  const goToSlide = (index) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % DEMO_SLIDES.length);
    setIsAutoPlaying(false);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + DEMO_SLIDES.length) % DEMO_SLIDES.length);
    setIsAutoPlaying(false);
  };

  if (!isOpen) return null;

  const slide = DEMO_SLIDES[currentSlide];
  const IconComponent = slide.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
        onClick={onClose}
        data-testid="demo-modal-overlay"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          data-testid="demo-modal"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/90 hover:bg-white shadow-lg transition-all"
            data-testid="demo-close-btn"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>

          <div className="grid lg:grid-cols-2">
            {/* Image Side */}
            <div className="relative h-64 lg:h-auto lg:min-h-[500px] bg-slate-900 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.img
                  key={slide.id}
                  src={slide.image}
                  alt={slide.title}
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </AnimatePresence>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent" />
              
              {/* Slide Counter */}
              <div className="absolute bottom-6 left-6 flex items-center gap-2">
                {DEMO_SLIDES.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => goToSlide(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === currentSlide ? 'w-8 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70'
                    }`}
                    data-testid={`demo-slide-indicator-${idx}`}
                  />
                ))}
              </div>

              {/* Play/Pause indicator */}
              <div className="absolute top-6 left-6">
                <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-full">
                  {currentSlide + 1} / {DEMO_SLIDES.length}
                </span>
              </div>
            </div>

            {/* Content Side */}
            <div className="p-8 lg:p-10 flex flex-col">
              <AnimatePresence mode="wait">
                <motion.div
                  key={slide.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="flex-1"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 rounded-xl bg-emerald-100">
                      <IconComponent className="w-6 h-6 text-emerald-600" />
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 uppercase tracking-wide">
                      Feature {currentSlide + 1}
                    </span>
                  </div>
                  
                  <h3 className="font-heading text-2xl lg:text-3xl font-bold text-slate-900 mb-4">
                    {slide.title}
                  </h3>
                  
                  <p className="text-slate-600 text-lg leading-relaxed mb-6">
                    {slide.description}
                  </p>
                  
                  <ul className="space-y-3 mb-8">
                    {slide.features.map((feature, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-center gap-3 text-slate-700"
                      >
                        <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        {feature}
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    onClick={prevSlide}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                    data-testid="demo-prev-btn"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <button
                    onClick={nextSlide}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                    data-testid="demo-next-btn"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
                
                <button
                  onClick={onGetStarted}
                  className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-all hover:-translate-y-0.5 shadow-lg shadow-emerald-600/25"
                  data-testid="demo-get-started-btn"
                >
                  Start Free Trial
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Landing Page
const LandingPage = () => {
  const navigate = useNavigate();
  const [showDemoModal, setShowDemoModal] = useState(false);
  
  const handleGetStarted = () => {
    setShowDemoModal(false);
    navigate('/onboarding');
  };
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Demo Modal */}
      <DemoModal 
        isOpen={showDemoModal} 
        onClose={() => setShowDemoModal(false)}
        onGetStarted={handleGetStarted}
      />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="https://customer-assets.emergentagent.com/job_lusaka-legal-tech/artifacts/xxn68wwl_Cove%20Premium%20Logo.png" 
              alt="Cove" 
              className="h-10"
              data-testid="cove-logo"
            />
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Features</a>
            <a href="#sectors" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Sectors</a>
            <a href="#about" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">About</a>
          </nav>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/admin')}
              className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
              data-testid="admin-link"
            >
              Admin
            </button>
            <button 
              onClick={() => navigate('/onboarding')}
              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-all hover:-translate-y-0.5"
              data-testid="get-started-btn"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-block px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold mb-6">
                Zambia's Leading Compliance Platform
              </span>
              <h1 className="font-heading text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
                Simplify Your <span className="text-emerald-600">Legal Compliance</span>
              </h1>
              <p className="text-xl text-slate-600 leading-relaxed mb-8">
                Navigate Zambian regulatory requirements with confidence. Cove helps businesses track obligations, meet deadlines, and maintain compliance across all sectors.
              </p>
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => navigate('/onboarding')}
                  className="bg-amber-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-amber-700 transition-all hover:-translate-y-0.5 shadow-lg shadow-amber-600/25"
                  data-testid="hero-cta-btn"
                >
                  Start Free Trial
                </button>
                <button 
                  onClick={() => setShowDemoModal(true)}
                  className="flex items-center gap-2 border-2 border-slate-300 text-slate-700 px-8 py-3.5 rounded-xl font-semibold hover:border-slate-400 hover:bg-slate-50 transition-all"
                  data-testid="watch-demo-btn"
                >
                  <Play className="w-5 h-5" />
                  Watch Demo
                </button>
              </div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl">
                <img 
                  src="https://images.unsplash.com/photo-1604783125462-37d81c7385e6?w=800&q=80" 
                  alt="Professional legal team" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-xl shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-emerald-600">98%</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Compliance Rate</p>
                    <p className="text-sm text-slate-500">Across our clients</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-heading text-4xl font-bold text-slate-900 mb-4">
              Everything You Need for Compliance
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Comprehensive tools designed specifically for Zambian businesses
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { title: "Compliance Matrix", desc: "Track all your regulatory obligations in one place with smart deadlines", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
              { title: "AI Summaries", desc: "Get plain-English explanations of complex legal requirements", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
              { title: "Gantt Timeline", desc: "Visualize your compliance calendar with interactive timelines", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
              { title: "Email Alerts", desc: "Never miss a deadline with automated reminders", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
              { title: "Multi-Sector", desc: "Covers mining, construction, finance, agriculture and more", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
              { title: "Super Admin", desc: "Full control for law firms managing multiple clients", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
            ].map((feature, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="bg-slate-50 p-8 rounded-2xl hover:shadow-lg transition-shadow group"
              >
                <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-emerald-600 transition-colors">
                  <svg className="w-7 h-7 text-emerald-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={feature.icon} />
                  </svg>
                </div>
                <h3 className="font-heading text-xl font-semibold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Sectors Section */}
      <section id="sectors" className="py-20 px-6 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-heading text-4xl font-bold text-white mb-4">
              Built for Zambian Industries
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Tailored compliance frameworks for every sector
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: "Mining", icon: "M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" },
              { name: "Construction", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
              { name: "Agriculture", icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" },
              { name: "Financial", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
              { name: "Manufacturing", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
              { name: "Power", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
            ].map((sector, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                viewport={{ once: true }}
                className="bg-slate-800 p-6 rounded-xl hover:bg-slate-700 transition-colors text-center group cursor-pointer"
              >
                <div className="w-12 h-12 mx-auto mb-4 bg-amber-600/20 rounded-lg flex items-center justify-center group-hover:bg-amber-600 transition-colors">
                  <svg className="w-6 h-6 text-amber-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={sector.icon} />
                  </svg>
                </div>
                <p className="text-white font-medium">{sector.name}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-emerald-600 to-emerald-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-heading text-4xl font-bold text-white mb-6">
            Ready to Simplify Your Compliance?
          </h2>
          <p className="text-xl text-emerald-100 mb-8">
            Join leading Zambian businesses using Cove to stay compliant
          </p>
          <button 
            onClick={() => navigate('/onboarding')}
            className="bg-white text-emerald-700 px-10 py-4 rounded-xl font-semibold hover:bg-emerald-50 transition-all hover:-translate-y-0.5 shadow-xl"
            data-testid="cta-get-started-btn"
          >
            Get Started Today
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <img 
              src="https://customer-assets.emergentagent.com/job_lusaka-legal-tech/artifacts/xxn68wwl_Cove%20Premium%20Logo.png" 
              alt="Cove" 
              className="h-8 brightness-200"
            />
            <p className="text-slate-400 text-sm">
              2026 Cove Legal Tech. Built for Zambian businesses.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/:companyId" element={<Dashboard />} />
          <Route path="/compliance" element={<ComplianceMatrix />} />
          <Route path="/compliance/:companyId" element={<ComplianceMatrix />} />
          <Route path="/admin" element={<AdminConsole />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
