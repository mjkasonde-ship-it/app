import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { toast } from "sonner";
import { 
  Building2, 
  Users, 
  Briefcase, 
  Layers,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  ArrowRight
} from "lucide-react";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Progress } from "../components/ui/progress";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const SECTORS = {
  mining: ["Base Metals", "Precious Metals", "Industrial Minerals", "Gemstones"],
  construction: ["Infrastructure", "Commercial Buildings", "Residential", "Civil Engineering"],
  agriculture: ["Crop Production", "Livestock", "Forestry", "Fisheries"],
  financial: ["Banking", "Insurance", "Investment", "Microfinance"],
  manufacturing: ["FMCG", "Industrial", "Textiles", "Food Processing"],
  power: ["Generation", "Distribution", "Renewable Energy", "Transmission"]
};

const COMPANY_SIZES = [
  { value: "small", label: "Small (1-50 employees)", desc: "Early stage companies" },
  { value: "medium", label: "Medium (51-200 employees)", desc: "Growing businesses" },
  { value: "large", label: "Large (201-1000 employees)", desc: "Established companies" },
  { value: "enterprise", label: "Enterprise (1000+ employees)", desc: "Large corporations" }
];

const steps = [
  { id: 1, title: "Company Info", icon: Building2, desc: "Basic details" },
  { id: 2, title: "Company Size", icon: Users, desc: "Employee count" },
  { id: 3, title: "Sector", icon: Briefcase, desc: "Industry type" },
  { id: 4, title: "Sub-Sector", icon: Layers, desc: "Specialization" }
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    registration_number: "",
    email: "",
    phone: "",
    address: "",
    size: "",
    sector: "",
    sub_sector: ""
  });

  const progress = (currentStep / 4) * 100;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name && formData.registration_number && formData.email;
      case 2:
        return formData.size;
      case 3:
        return formData.sector;
      case 4:
        return formData.sub_sector;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 4 && canProceed()) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!canProceed()) return;
    
    setIsSubmitting(true);
    try {
      const response = await axios.post(`${API}/companies`, formData);
      toast.success("Company registered successfully!");
      navigate(`/dashboard/${response.data.id}`);
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Failed to register company. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const slideVariants = {
    enter: (direction) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction) => ({
      x: direction < 0 ? 100 : -100,
      opacity: 0
    })
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-2/5 bg-slate-900 relative overflow-hidden">
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url(https://images.unsplash.com/photo-1745701092460-47a5bf96e537?w=800&q=80)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
        <div className="relative z-10 p-12 flex flex-col justify-between">
          <div>
            <img 
              src="https://customer-assets.emergentagent.com/job_lusaka-legal-tech/artifacts/xxn68wwl_Cove%20Premium%20Logo.png" 
              alt="Cove" 
              className="h-28 brightness-200 mb-12"
              data-testid="onboarding-logo"
            />
            <h1 className="font-heading text-4xl font-bold text-white mb-6">
              Welcome to Cove
            </h1>
            <p className="text-slate-300 text-lg leading-relaxed">
              Zambia's premier compliance management platform. Let's get your company set up for regulatory success.
            </p>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
            <p className="text-slate-300 italic mb-4">
              &ldquo;Cove transformed how we manage compliance. We haven&apos;t missed a deadline since we started using it.&rdquo;
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-600 rounded-full flex items-center justify-center text-white font-semibold">
                JM
              </div>
              <div>
                <p className="text-white font-medium">John Mwanza</p>
                <p className="text-slate-400 text-sm">CFO, Copper Belt Mining Ltd</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 bg-slate-50 p-6 lg:p-12 flex flex-col">
        {/* Mobile Logo */}
        <div className="lg:hidden mb-8">
          <img 
            src="https://customer-assets.emergentagent.com/job_lusaka-legal-tech/artifacts/xxn68wwl_Cove%20Premium%20Logo.png" 
            alt="Cove" 
            className="h-20"
          />
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex flex-col items-center ${idx > 0 ? 'ml-4' : ''}`}>
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      currentStep > step.id 
                        ? 'bg-emerald-600 text-white' 
                        : currentStep === step.id 
                          ? 'bg-slate-900 text-white' 
                          : 'bg-slate-200 text-slate-500'
                    }`}
                    data-testid={`step-${step.id}-indicator`}
                  >
                    {currentStep > step.id ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className="hidden md:block text-xs mt-2 text-slate-600 font-medium">{step.title}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`hidden sm:block w-16 lg:w-24 h-0.5 ml-4 ${
                    currentStep > step.id ? 'bg-emerald-600' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Form Content */}
        <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full">
          <AnimatePresence mode="wait" custom={currentStep}>
            <motion.div
              key={currentStep}
              custom={currentStep}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
            >
              {/* Step 1: Company Info */}
              {currentStep === 1 && (
                <div className="space-y-6" data-testid="step-1-form">
                  <div>
                    <h2 className="font-heading text-3xl font-bold text-slate-900 mb-2">
                      Company Information
                    </h2>
                    <p className="text-slate-600">
                      Enter your company&apos;s basic details
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name" className="text-slate-700 font-medium">Company Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="e.g., Zambia Mining Corp"
                        className="mt-1.5 h-12"
                        data-testid="company-name-input"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="reg" className="text-slate-700 font-medium">PACRA Registration Number *</Label>
                      <Input
                        id="reg"
                        value={formData.registration_number}
                        onChange={(e) => handleInputChange('registration_number', e.target.value)}
                        placeholder="e.g., 120000/12345"
                        className="mt-1.5 h-12"
                        data-testid="registration-number-input"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="email" className="text-slate-700 font-medium">Business Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="compliance@company.co.zm"
                        className="mt-1.5 h-12"
                        data-testid="email-input"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="phone" className="text-slate-700 font-medium">Phone (Optional)</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="+260 XXX XXX XXX"
                        className="mt-1.5 h-12"
                        data-testid="phone-input"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Company Size */}
              {currentStep === 2 && (
                <div className="space-y-6" data-testid="step-2-form">
                  <div>
                    <h2 className="font-heading text-3xl font-bold text-slate-900 mb-2">
                      Company Size
                    </h2>
                    <p className="text-slate-600">
                      Select your organization&apos;s size
                    </p>
                  </div>
                  
                  <div className="grid gap-3">
                    {COMPANY_SIZES.map((size) => (
                      <button
                        key={size.value}
                        onClick={() => handleInputChange('size', size.value)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          formData.size === size.value 
                            ? 'border-emerald-600 bg-emerald-50' 
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                        data-testid={`size-${size.value}-btn`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">{size.label}</p>
                            <p className="text-sm text-slate-500">{size.desc}</p>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            formData.size === size.value 
                              ? 'border-emerald-600 bg-emerald-600' 
                              : 'border-slate-300'
                          }`}>
                            {formData.size === size.value && (
                              <CheckCircle className="w-4 h-4 text-white" />
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Sector */}
              {currentStep === 3 && (
                <div className="space-y-6" data-testid="step-3-form">
                  <div>
                    <h2 className="font-heading text-3xl font-bold text-slate-900 mb-2">
                      Industry Sector
                    </h2>
                    <p className="text-slate-600">
                      Select your primary business sector
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {Object.keys(SECTORS).map((sector) => (
                      <button
                        key={sector}
                        onClick={() => {
                          handleInputChange('sector', sector);
                          handleInputChange('sub_sector', '');
                        }}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          formData.sector === sector 
                            ? 'border-amber-600 bg-amber-50' 
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                        data-testid={`sector-${sector}-btn`}
                      >
                        <p className="font-semibold text-slate-900 capitalize">{sector}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {SECTORS[sector].length} sub-sectors
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Sub-Sector */}
              {currentStep === 4 && (
                <div className="space-y-6" data-testid="step-4-form">
                  <div>
                    <h2 className="font-heading text-3xl font-bold text-slate-900 mb-2">
                      Sub-Sector
                    </h2>
                    <p className="text-slate-600">
                      Select your specific area within {formData.sector}
                    </p>
                  </div>
                  
                  <div className="grid gap-3">
                    {SECTORS[formData.sector]?.map((subSector) => (
                      <button
                        key={subSector}
                        onClick={() => handleInputChange('sub_sector', subSector)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          formData.sub_sector === subSector 
                            ? 'border-emerald-600 bg-emerald-50' 
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                        data-testid={`subsector-${subSector.toLowerCase().replace(/\s+/g, '-')}-btn`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-slate-900">{subSector}</p>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            formData.sub_sector === subSector 
                              ? 'border-emerald-600 bg-emerald-600' 
                              : 'border-slate-300'
                          }`}>
                            {formData.sub_sector === subSector && (
                              <CheckCircle className="w-4 h-4 text-white" />
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 1}
              className="gap-2"
              data-testid="back-btn"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
            
            {currentStep < 4 ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className="gap-2 bg-slate-900 hover:bg-slate-800"
                data-testid="next-btn"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed() || isSubmitting}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                data-testid="submit-btn"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </span>
                    Creating...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
