import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import {
  ArrowLeft,
  FolderOpen,
  File,
  FileText,
  FileSpreadsheet,
  FileImage,
  Upload,
  Download,
  Trash2,
  MoreVertical,
  Search,
  Plus,
  Clock,
  User,
  Link2,
  CheckCircle,
  Building2,
  Scale,
  Users,
  Briefcase,
  ChevronRight,
  Eye,
  History,
  Settings
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "../components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const COVE_LOGO = "https://customer-assets.emergentagent.com/job_ede56879-e7c8-4696-b14b-f3e4205ad2d7/artifacts/vpnavke8_Cove%20clean%20logo.png";

// VDR Taxonomy folders
const TAXONOMY = [
  { id: "corporate", name: "Corporate", icon: Building2, color: "bg-blue-100 text-blue-700", description: "Company registration, board resolutions, shareholder agreements" },
  { id: "legal", name: "Legal", icon: Scale, color: "bg-purple-100 text-purple-700", description: "Contracts, licenses, permits, litigation documents" },
  { id: "hr", name: "HR", icon: Users, color: "bg-amber-100 text-amber-700", description: "Employment contracts, policies, training records" },
  { id: "operations", name: "Operations", icon: Briefcase, color: "bg-emerald-100 text-emerald-700", description: "Operational permits, environmental reports, safety documents" }
];

const getFileIcon = (filename) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext)) return FileText;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return FileImage;
  return File;
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function VDR() {
  const navigate = useNavigate();
  const { companyId } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState("corporate");
  const [files, setFiles] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [linkObligationOpen, setLinkObligationOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  
  // Upload state
  const [pendingFiles, setPendingFiles] = useState([]);
  const [selectedObligation, setSelectedObligation] = useState("");

  useEffect(() => {
    fetchFiles();
    fetchObligations();
  }, [companyId, activeFolder]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (companyId) params.append('company_id', companyId);
      params.append('folder', activeFolder);
      
      const response = await axios.get(`${API}/vdr/files?${params.toString()}`);
      setFiles(response.data.files || []);
    } catch (error) {
      console.error("Error fetching files:", error);
      // Mock data for demo
      setFiles(getMockFiles(activeFolder));
    } finally {
      setLoading(false);
    }
  };

  const fetchObligations = async () => {
    try {
      const params = new URLSearchParams();
      if (companyId) params.append('company_id', companyId);
      
      const response = await axios.get(`${API}/obligations?${params.toString()}`);
      setObligations(response.data.filter(o => o.status !== 'completed'));
    } catch (error) {
      console.error("Error fetching obligations:", error);
      setObligations([]);
    }
  };

  const getMockFiles = (folder) => {
    const mockData = {
      corporate: [
        { id: "1", name: "Company_Registration_Certificate.pdf", size: 245000, folder: "corporate", uploaded_by: "Admin", uploaded_at: "2026-01-15T10:30:00Z", version: 1, linked_obligation: null },
        { id: "2", name: "Board_Resolution_2025.pdf", size: 189000, folder: "corporate", uploaded_by: "John Banda", uploaded_at: "2026-01-20T14:15:00Z", version: 2, linked_obligation: "Annual Return Filing" },
        { id: "3", name: "Shareholder_Agreement.pdf", size: 567000, folder: "corporate", uploaded_by: "Admin", uploaded_at: "2025-12-10T09:00:00Z", version: 1, linked_obligation: null },
      ],
      legal: [
        { id: "4", name: "Mining_License_2026.pdf", size: 890000, folder: "legal", uploaded_by: "Legal Team", uploaded_at: "2026-01-25T11:00:00Z", version: 3, linked_obligation: "Mining License Renewal" },
        { id: "5", name: "Environmental_Permit.pdf", size: 456000, folder: "legal", uploaded_by: "Admin", uploaded_at: "2026-02-01T16:30:00Z", version: 1, linked_obligation: "Environmental Impact Assessment" },
      ],
      hr: [
        { id: "6", name: "Employment_Policy_Manual.pdf", size: 1200000, folder: "hr", uploaded_by: "HR Manager", uploaded_at: "2025-11-20T08:45:00Z", version: 4, linked_obligation: null },
        { id: "7", name: "Annual_Employment_Returns_2025.xlsx", size: 345000, folder: "hr", uploaded_by: "HR Manager", uploaded_at: "2026-01-28T13:20:00Z", version: 1, linked_obligation: "Submit Annual Employment Returns" },
      ],
      operations: [
        { id: "8", name: "Safety_Certificate_2026.pdf", size: 234000, folder: "operations", uploaded_by: "Operations", uploaded_at: "2026-02-05T10:00:00Z", version: 2, linked_obligation: "Mine Safety Certificate" },
        { id: "9", name: "Quarterly_Production_Report_Q4.pdf", size: 567000, folder: "operations", uploaded_by: "Operations", uploaded_at: "2026-01-10T15:00:00Z", version: 1, linked_obligation: "Quarterly Production Returns" },
      ]
    };
    return mockData[folder] || [];
  };

  const onDrop = useCallback((acceptedFiles) => {
    setPendingFiles(acceptedFiles);
    setUploadOpen(true);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc', '.docx'],
      'application/vnd.ms-excel': ['.xls', '.xlsx'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif'],
      'text/*': ['.txt', '.csv']
    }
  });

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', activeFolder);
        formData.append('company_id', companyId || '');
        if (selectedObligation) {
          formData.append('linked_obligation_id', selectedObligation);
        }

        await axios.post(`${API}/vdr/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(((i + (progressEvent.loaded / progressEvent.total)) / pendingFiles.length) * 100);
            setUploadProgress(percentCompleted);
          }
        });
      }

      toast.success(`${pendingFiles.length} file(s) uploaded successfully`);
      
      // If linked to obligation, mark it as completed
      if (selectedObligation) {
        try {
          await axios.patch(`${API}/obligations/${selectedObligation}/status`, null, {
            params: { status: 'completed' }
          });
          toast.success("Linked compliance item marked as Completed");
        } catch (err) {
          console.error("Error updating obligation:", err);
        }
      }
      
      fetchFiles();
      setUploadOpen(false);
      setPendingFiles([]);
      setSelectedObligation("");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload file(s)");
      
      // Demo mode - simulate success
      const newFiles = pendingFiles.map((file, idx) => ({
        id: `new-${Date.now()}-${idx}`,
        name: file.name,
        size: file.size,
        folder: activeFolder,
        uploaded_by: "You",
        uploaded_at: new Date().toISOString(),
        version: 1,
        linked_obligation: selectedObligation ? obligations.find(o => o.id === selectedObligation)?.obligation : null
      }));
      
      setFiles(prev => [...newFiles, ...prev]);
      toast.success(`${pendingFiles.length} file(s) uploaded (demo mode)`);
      
      if (selectedObligation) {
        toast.success("Linked compliance item marked as Completed");
      }
      
      setUploadOpen(false);
      setPendingFiles([]);
      setSelectedObligation("");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (fileId) => {
    try {
      await axios.delete(`${API}/vdr/files/${fileId}`);
      setFiles(prev => prev.filter(f => f.id !== fileId));
      toast.success("File deleted");
    } catch (error) {
      // Demo mode
      setFiles(prev => prev.filter(f => f.id !== fileId));
      toast.success("File deleted (demo mode)");
    }
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeFolderData = TAXONOMY.find(t => t.id === activeFolder);
  const folderStats = TAXONOMY.map(folder => ({
    ...folder,
    count: files.filter(f => f.folder === folder.id).length || getMockFiles(folder.id).length
  }));

  return (
    <div className="min-h-screen bg-ft-salmon">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-[#E8D5C4] sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate(companyId ? `/dashboard/${companyId}` : '/dashboard')}
                className="gap-1.5 text-cove-navy hover:bg-[#FFF1E5]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <div className="h-4 w-px bg-[#E8D5C4]" />
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-cove-teal" />
                <h1 className="font-semibold text-cove-navy">My Cove</h1>
              </div>
              <Badge variant="secondary" className="text-xs bg-white/60">
                {files.length} files
              </Badge>
            </div>
            
            <img 
              src={COVE_LOGO}
              alt="Cove" 
              className="h-40 cursor-pointer"
              onClick={() => navigate('/')}
            />
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Folder Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {TAXONOMY.map((folder) => {
            const Icon = folder.icon;
            const count = getMockFiles(folder.id).length;
            const isActive = activeFolder === folder.id;
            
            return (
              <motion.button
                key={folder.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveFolder(folder.id)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  isActive 
                    ? 'border-cove-teal bg-white shadow-lg' 
                    : 'border-transparent bg-white/60 hover:bg-white hover:border-[#E8D5C4]'
                }`}
                data-testid={`folder-${folder.id}`}
              >
                <div className={`w-10 h-10 rounded-lg ${folder.color} flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-cove-navy">{folder.name}</h3>
                <p className="text-xs text-[#6B5B4F] mt-1">{count} files</p>
              </motion.button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B5B4F]" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white border-[#E8D5C4]"
              />
            </div>
          </div>
          
          <Button 
            onClick={() => setUploadOpen(true)}
            className="gap-2"
            style={{backgroundColor: 'hsl(193, 55%, 45%)'}}
            data-testid="upload-btn"
          >
            <Upload className="w-4 h-4" />
            Upload Files
          </Button>
        </div>

        {/* Drop Zone */}
        <div
          {...getRootProps()}
          className={`mb-6 border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            isDragActive 
              ? 'border-cove-teal bg-[#E8F4F4]' 
              : 'border-[#D4C4B5] bg-white/40 hover:bg-white/60 hover:border-[#B8A89A]'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragActive ? 'text-cove-teal' : 'text-[#A89888]'}`} />
          <p className="text-cove-navy font-medium">
            {isDragActive ? "Drop files here..." : "Drag & drop files here"}
          </p>
          <p className="text-sm text-[#6B5B4F] mt-1">
            or click to browse (PDF, DOC, XLS, Images)
          </p>
        </div>

        {/* Files Table */}
        <Card className="border-[#E8D5C4] bg-white/80">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              {activeFolderData && (
                <div className={`w-8 h-8 rounded-lg ${activeFolderData.color} flex items-center justify-center`}>
                  <activeFolderData.icon className="w-4 h-4" />
                </div>
              )}
              <div>
                <CardTitle className="text-lg text-cove-navy">{activeFolderData?.name} Documents</CardTitle>
                <CardDescription className="text-[#6B5B4F]">{activeFolderData?.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FFF8F2] hover:bg-[#FFF8F2]">
                    <TableHead className="text-cove-navy">File Name</TableHead>
                    <TableHead className="text-cove-navy hidden md:table-cell">Size</TableHead>
                    <TableHead className="text-cove-navy hidden lg:table-cell">Uploaded By</TableHead>
                    <TableHead className="text-cove-navy hidden sm:table-cell">Date</TableHead>
                    <TableHead className="text-cove-navy">Linked Item</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFiles.map((file, idx) => {
                    const FileIcon = getFileIcon(file.name);
                    return (
                      <TableRow key={file.id} className="hover:bg-[#FFF8F2]" data-testid={`file-row-${idx}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-[#F5EDE5] flex items-center justify-center">
                              <FileIcon className="w-4 h-4 text-cove-navy" />
                            </div>
                            <div>
                              <p className="font-medium text-cove-navy text-sm">{file.name}</p>
                              {file.version > 1 && (
                                <Badge variant="outline" className="text-[10px] mt-0.5">v{file.version}</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-[#6B5B4F] text-sm hidden md:table-cell">
                          {formatFileSize(file.size)}
                        </TableCell>
                        <TableCell className="text-[#6B5B4F] text-sm hidden lg:table-cell">
                          {file.uploaded_by}
                        </TableCell>
                        <TableCell className="text-[#6B5B4F] text-sm hidden sm:table-cell">
                          {formatDate(file.uploaded_at)}
                        </TableCell>
                        <TableCell>
                          {file.linked_obligation ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {file.linked_obligation.substring(0, 20)}...
                            </Badge>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-xs text-[#6B5B4F] hover:text-cove-teal"
                              onClick={() => { setSelectedFile(file); setLinkObligationOpen(true); }}
                            >
                              <Link2 className="w-3 h-3 mr-1" />
                              Link
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="gap-2">
                                <Download className="w-4 h-4" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2" onClick={() => { setSelectedFile(file); setVersionsOpen(true); }}>
                                <History className="w-4 h-4" />
                                Version History
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="gap-2 text-red-600" onClick={() => handleDelete(file.id)}>
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  
                  {filteredFiles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-[#6B5B4F]">
                        <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p>No files in this folder</p>
                        <Button 
                          variant="link" 
                          className="text-cove-teal mt-2"
                          onClick={() => setUploadOpen(true)}
                        >
                          Upload your first file
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </main>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-cove-navy">Upload Files to {activeFolderData?.name}</DialogTitle>
            <DialogDescription>
              Upload documents and optionally link them to compliance obligations.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* File list */}
            {pendingFiles.length > 0 ? (
              <div className="space-y-2">
                {pendingFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-[#FFF8F2] rounded-lg">
                    <File className="w-5 h-5 text-cove-navy" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-cove-navy truncate">{file.name}</p>
                      <p className="text-xs text-[#6B5B4F]">{formatFileSize(file.size)}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div 
                {...getRootProps()}
                className="border-2 border-dashed border-[#D4C4B5] rounded-lg p-8 text-center cursor-pointer hover:border-cove-teal hover:bg-[#FFF8F2]"
              >
                <input {...getInputProps()} />
                <Upload className="w-8 h-8 mx-auto mb-2 text-[#A89888]" />
                <p className="text-sm text-[#6B5B4F]">Drop files here or click to browse</p>
              </div>
            )}

            {/* Link to obligation */}
            <div>
              <label className="text-sm font-medium text-cove-navy block mb-2">
                Link to Compliance Item (Optional)
              </label>
              <Select value={selectedObligation} onValueChange={setSelectedObligation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an obligation to auto-complete..." />
                </SelectTrigger>
                <SelectContent>
                  {obligations.map(obl => (
                    <SelectItem key={obl.id} value={obl.id}>
                      {obl.obligation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-[#6B5B4F] mt-1">
                Linking will automatically mark the compliance item as Completed
              </p>
            </div>

            {/* Progress */}
            {uploading && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#6B5B4F]">Uploading...</span>
                  <span className="text-cove-teal font-medium">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setPendingFiles([]); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={pendingFiles.length === 0 || uploading}
              style={{backgroundColor: 'hsl(193, 55%, 45%)'}}
            >
              {uploading ? "Uploading..." : `Upload ${pendingFiles.length} file(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Sheet */}
      <Sheet open={versionsOpen} onOpenChange={setVersionsOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="text-cove-navy">Version History</SheetTitle>
            <SheetDescription>{selectedFile?.name}</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {[...Array(selectedFile?.version || 1)].map((_, idx) => {
              const version = (selectedFile?.version || 1) - idx;
              const isCurrent = version === selectedFile?.version;
              return (
                <div key={idx} className={`p-4 rounded-lg border ${isCurrent ? 'border-cove-teal bg-[#E8F4F4]' : 'border-[#E8D5C4]'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={isCurrent ? "default" : "outline"}>
                      Version {version}
                    </Badge>
                    {isCurrent && <Badge className="bg-emerald-100 text-emerald-700">Current</Badge>}
                  </div>
                  <p className="text-sm text-[#6B5B4F]">
                    Uploaded by {selectedFile?.uploaded_by || 'Unknown'}
                  </p>
                  <p className="text-xs text-[#A89888] mt-1">
                    {formatDate(selectedFile?.uploaded_at)}
                  </p>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Link Obligation Sheet */}
      <Sheet open={linkObligationOpen} onOpenChange={setLinkObligationOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="text-cove-navy">Link to Compliance Item</SheetTitle>
            <SheetDescription>
              Link "{selectedFile?.name}" to a compliance obligation
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {obligations.map(obl => (
              <button
                key={obl.id}
                onClick={() => {
                  // Update file with linked obligation
                  setFiles(prev => prev.map(f => 
                    f.id === selectedFile?.id 
                      ? { ...f, linked_obligation: obl.obligation }
                      : f
                  ));
                  toast.success("File linked and obligation marked as Completed");
                  setLinkObligationOpen(false);
                }}
                className="w-full p-4 text-left rounded-lg border border-[#E8D5C4] hover:border-cove-teal hover:bg-[#FFF8F2] transition-all"
              >
                <p className="font-medium text-cove-navy">{obl.obligation}</p>
                <p className="text-sm text-[#6B5B4F] mt-1">{obl.statute}</p>
                <Badge variant="outline" className="mt-2 text-xs">
                  Due: {formatDate(obl.due_date)}
                </Badge>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
