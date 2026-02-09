import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft,
  Settings as SettingsIcon,
  Users,
  Shield,
  Mail,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronRight,
  Building2,
  Scale,
  Briefcase,
  UserPlus,
  Key,
  Eye,
  EyeOff,
  Copy,
  MoreVertical
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { ScrollArea } from "../components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Checkbox } from "../components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const COVE_LOGO = "https://customer-assets.emergentagent.com/job_ede56879-e7c8-4696-b14b-f3e4205ad2d7/artifacts/vpnavke8_Cove%20clean%20logo.png";

// Available roles
const ROLES = [
  { id: "admin", name: "Admin", description: "Full access to all features", color: "bg-red-100 text-red-700" },
  { id: "legal", name: "Legal", description: "Manage legal compliance and documents", color: "bg-purple-100 text-purple-700" },
  { id: "corporate", name: "Corporate", description: "Corporate governance and filings", color: "bg-blue-100 text-blue-700" },
  { id: "hr", name: "HR", description: "Employee compliance and HR documents", color: "bg-amber-100 text-amber-700" },
  { id: "operations", name: "Operations", description: "Operational permits and safety", color: "bg-emerald-100 text-emerald-700" },
  { id: "finance", name: "Finance", description: "Financial compliance and tax", color: "bg-cyan-100 text-cyan-700" },
  { id: "viewer", name: "Viewer", description: "Read-only access", color: "bg-slate-100 text-slate-700" }
];

// Permission categories
const PERMISSION_CATEGORIES = [
  {
    id: "compliance",
    name: "Compliance Matrix",
    permissions: [
      { id: "view_compliance", name: "View Obligations", description: "View compliance items" },
      { id: "edit_compliance", name: "Edit Status", description: "Update obligation status" },
      { id: "create_compliance", name: "Create Items", description: "Add new obligations" },
      { id: "delete_compliance", name: "Delete Items", description: "Remove obligations" }
    ]
  },
  {
    id: "vdr",
    name: "Document Repository (My Cove)",
    permissions: [
      { id: "view_documents", name: "View Documents", description: "Access VDR files" },
      { id: "upload_documents", name: "Upload Files", description: "Upload new documents" },
      { id: "delete_documents", name: "Delete Files", description: "Remove documents" },
      { id: "link_documents", name: "Link to Compliance", description: "Link files to obligations" }
    ]
  },
  {
    id: "users",
    name: "User Management",
    permissions: [
      { id: "view_users", name: "View Users", description: "See team members" },
      { id: "invite_users", name: "Invite Users", description: "Add new team members" },
      { id: "edit_users", name: "Edit Users", description: "Modify user details" },
      { id: "delete_users", name: "Remove Users", description: "Remove team members" }
    ]
  },
  {
    id: "settings",
    name: "Settings",
    permissions: [
      { id: "view_settings", name: "View Settings", description: "Access settings page" },
      { id: "edit_settings", name: "Edit Settings", description: "Modify organization settings" },
      { id: "manage_roles", name: "Manage Roles", description: "Configure role permissions" }
    ]
  }
];

// Default role permissions
const DEFAULT_PERMISSIONS = {
  admin: ["view_compliance", "edit_compliance", "create_compliance", "delete_compliance", "view_documents", "upload_documents", "delete_documents", "link_documents", "view_users", "invite_users", "edit_users", "delete_users", "view_settings", "edit_settings", "manage_roles"],
  legal: ["view_compliance", "edit_compliance", "view_documents", "upload_documents", "link_documents", "view_users"],
  corporate: ["view_compliance", "edit_compliance", "view_documents", "upload_documents", "link_documents", "view_users"],
  hr: ["view_compliance", "edit_compliance", "view_documents", "upload_documents", "link_documents", "view_users"],
  operations: ["view_compliance", "edit_compliance", "view_documents", "upload_documents", "link_documents", "view_users"],
  finance: ["view_compliance", "edit_compliance", "view_documents", "upload_documents", "view_users"],
  viewer: ["view_compliance", "view_documents", "view_users"]
};

export default function Settings() {
  const navigate = useNavigate();
  const { companyId } = useParams();
  
  const [activeTab, setActiveTab] = useState("team");
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState(ROLES.map(r => ({ ...r, permissions: DEFAULT_PERMISSIONS[r.id] || [] })));
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteName, setInviteName] = useState("");

  useEffect(() => {
    fetchUsers();
  }, [companyId]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/users`, {
        params: { company_id: companyId }
      });
      setUsers(response.data);
    } catch (error) {
      // Mock data
      setUsers([
        { id: "1", name: "John Banda", email: "john@cove.zm", role: "admin", status: "active", last_active: "2026-02-09T10:30:00Z" },
        { id: "2", name: "Mary Mwanza", email: "mary@cove.zm", role: "legal", status: "active", last_active: "2026-02-08T16:45:00Z" },
        { id: "3", name: "Peter Zimba", email: "peter@cove.zm", role: "hr", status: "active", last_active: "2026-02-09T09:15:00Z" },
        { id: "4", name: "Grace Phiri", email: "grace@cove.zm", role: "operations", status: "pending", last_active: null },
        { id: "5", name: "David Tembo", email: "david@cove.zm", role: "finance", status: "active", last_active: "2026-02-07T14:20:00Z" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail || !inviteName) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      await axios.post(`${API}/users/invite`, {
        email: inviteEmail,
        name: inviteName,
        role: inviteRole,
        company_id: companyId
      });
      toast.success(`Invitation sent to ${inviteEmail}`);
    } catch (error) {
      // Demo mode
      const newUser = {
        id: `new-${Date.now()}`,
        name: inviteName,
        email: inviteEmail,
        role: inviteRole,
        status: "pending",
        last_active: null
      };
      setUsers(prev => [...prev, newUser]);
      toast.success(`Invitation sent to ${inviteEmail} (demo mode)`);
    }
    
    setInviteOpen(false);
    setInviteEmail("");
    setInviteName("");
    setInviteRole("viewer");
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await axios.patch(`${API}/users/${userId}`, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success("User role updated");
    } catch (error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success("User role updated (demo mode)");
    }
  };

  const handleRemoveUser = async (userId) => {
    try {
      await axios.delete(`${API}/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success("User removed");
    } catch (error) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success("User removed (demo mode)");
    }
  };

  const handleTogglePermission = (roleId, permissionId) => {
    setRoles(prev => prev.map(role => {
      if (role.id === roleId) {
        const hasPermission = role.permissions.includes(permissionId);
        return {
          ...role,
          permissions: hasPermission 
            ? role.permissions.filter(p => p !== permissionId)
            : [...role.permissions, permissionId]
        };
      }
      return role;
    }));
  };

  const getRoleData = (roleId) => ROLES.find(r => r.id === roleId) || ROLES[ROLES.length - 1];

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-ft-salmon">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-[#E8D5C4] sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
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
                <SettingsIcon className="w-5 h-5 text-cove-teal" />
                <h1 className="font-semibold text-cove-navy">Settings</h1>
              </div>
            </div>
            
            <img 
              src={COVE_LOGO}
              alt="Cove" 
              className="h-10 cursor-pointer"
              onClick={() => navigate('/')}
            />
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/60 border border-[#E8D5C4]">
            <TabsTrigger value="team" className="gap-2 data-[state=active]:bg-white">
              <Users className="w-4 h-4" />
              Team
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2 data-[state=active]:bg-white">
              <Shield className="w-4 h-4" />
              Roles & Permissions
            </TabsTrigger>
          </TabsList>

          {/* Team Tab */}
          <TabsContent value="team">
            <Card className="border-[#E8D5C4] bg-white/80">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-cove-navy">Team Members</CardTitle>
                    <CardDescription className="text-[#6B5B4F]">
                      Manage your organization's users and their access levels
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => setInviteOpen(true)}
                    className="gap-2"
                    style={{backgroundColor: 'hsl(193, 55%, 45%)'}}
                    data-testid="invite-user-btn"
                  >
                    <UserPlus className="w-4 h-4" />
                    Invite User
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#FFF8F2] hover:bg-[#FFF8F2]">
                      <TableHead className="text-cove-navy">User</TableHead>
                      <TableHead className="text-cove-navy">Role</TableHead>
                      <TableHead className="text-cove-navy hidden md:table-cell">Status</TableHead>
                      <TableHead className="text-cove-navy hidden lg:table-cell">Last Active</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user, idx) => {
                      const roleData = getRoleData(user.role);
                      return (
                        <TableRow key={user.id} className="hover:bg-[#FFF8F2]" data-testid={`user-row-${idx}`}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-cove-teal/20 flex items-center justify-center text-cove-teal font-medium">
                                {user.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div>
                                <p className="font-medium text-cove-navy">{user.name}</p>
                                <p className="text-sm text-[#6B5B4F]">{user.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select 
                              value={user.role} 
                              onValueChange={(val) => handleUpdateRole(user.id, val)}
                            >
                              <SelectTrigger className={`w-32 h-8 ${roleData.color} border-0`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map(role => (
                                  <SelectItem key={role.id} value={role.id}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge 
                              variant="outline" 
                              className={user.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}
                            >
                              {user.status === 'active' ? 'Active' : 'Pending'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[#6B5B4F] text-sm hidden lg:table-cell">
                            {formatDate(user.last_active)}
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
                                  <Mail className="w-4 h-4" />
                                  Resend Invite
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="gap-2 text-red-600"
                                  onClick={() => handleRemoveUser(user.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Remove User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roles & Permissions Tab */}
          <TabsContent value="roles">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Roles List */}
              <Card className="lg:col-span-1 border-[#E8D5C4] bg-white/80">
                <CardHeader>
                  <CardTitle className="text-cove-navy text-lg">Roles</CardTitle>
                  <CardDescription className="text-[#6B5B4F]">
                    Select a role to customize permissions
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-[#E8D5C4]">
                    {roles.map(role => (
                      <button
                        key={role.id}
                        onClick={() => { setSelectedRole(role); setEditRoleOpen(true); }}
                        className={`w-full p-4 text-left hover:bg-[#FFF8F2] transition-colors flex items-center justify-between ${
                          selectedRole?.id === role.id ? 'bg-[#FFF8F2]' : ''
                        }`}
                        data-testid={`role-${role.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg ${role.color} flex items-center justify-center`}>
                            <Shield className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-medium text-cove-navy">{role.name}</p>
                            <p className="text-xs text-[#6B5B4F]">{role.permissions.length} permissions</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#A89888]" />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Permissions Matrix */}
              <Card className="lg:col-span-2 border-[#E8D5C4] bg-white/80">
                <CardHeader>
                  <CardTitle className="text-cove-navy text-lg">Permissions Matrix</CardTitle>
                  <CardDescription className="text-[#6B5B4F]">
                    Overview of all role permissions
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#FFF8F2]">
                          <TableHead className="text-cove-navy w-48">Permission</TableHead>
                          {ROLES.slice(0, 5).map(role => (
                            <TableHead key={role.id} className="text-center text-cove-navy w-20">
                              <span className="text-xs">{role.name}</span>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {PERMISSION_CATEGORIES.map(category => (
                          <>
                            <TableRow key={`cat-${category.id}`} className="bg-[#FFF8F2]/50">
                              <TableCell colSpan={6} className="font-medium text-cove-navy py-2">
                                {category.name}
                              </TableCell>
                            </TableRow>
                            {category.permissions.map(perm => (
                              <TableRow key={perm.id} className="hover:bg-[#FFF8F2]">
                                <TableCell className="text-sm text-[#6B5B4F]">
                                  {perm.name}
                                </TableCell>
                                {ROLES.slice(0, 5).map(role => {
                                  const roleData = roles.find(r => r.id === role.id);
                                  const hasPermission = roleData?.permissions.includes(perm.id);
                                  return (
                                    <TableCell key={role.id} className="text-center">
                                      <Checkbox
                                        checked={hasPermission}
                                        onCheckedChange={() => handleTogglePermission(role.id, perm.id)}
                                        className={hasPermission ? 'bg-cove-teal border-cove-teal' : ''}
                                      />
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                          </>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Invite User Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-cove-navy">Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your organization
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-cove-navy">Full Name</Label>
              <Input
                placeholder="Enter name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-cove-navy">Email Address</Label>
              <Input
                type="email"
                placeholder="Enter email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-cove-navy">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      <div>
                        <p>{role.name}</p>
                        <p className="text-xs text-[#6B5B4F]">{role.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleInviteUser}
              style={{backgroundColor: 'hsl(193, 55%, 45%)'}}
            >
              <Mail className="w-4 h-4 mr-2" />
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={editRoleOpen} onOpenChange={setEditRoleOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-cove-navy flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${selectedRole?.color} flex items-center justify-center`}>
                <Shield className="w-4 h-4" />
              </div>
              {selectedRole?.name} Role
            </DialogTitle>
            <DialogDescription>
              {selectedRole?.description}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6">
              {PERMISSION_CATEGORIES.map(category => (
                <div key={category.id}>
                  <h4 className="font-medium text-cove-navy mb-3">{category.name}</h4>
                  <div className="space-y-2">
                    {category.permissions.map(perm => {
                      const hasPermission = selectedRole?.permissions.includes(perm.id);
                      return (
                        <div 
                          key={perm.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-[#FFF8F2] hover:bg-[#FFF1E5]"
                        >
                          <div>
                            <p className="text-sm font-medium text-cove-navy">{perm.name}</p>
                            <p className="text-xs text-[#6B5B4F]">{perm.description}</p>
                          </div>
                          <Switch
                            checked={hasPermission}
                            onCheckedChange={() => {
                              if (selectedRole) {
                                handleTogglePermission(selectedRole.id, perm.id);
                                setSelectedRole(prev => prev ? {
                                  ...prev,
                                  permissions: hasPermission 
                                    ? prev.permissions.filter(p => p !== perm.id)
                                    : [...prev.permissions, perm.id]
                                } : null);
                              }
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoleOpen(false)}>
              Close
            </Button>
            <Button 
              onClick={() => {
                toast.success(`${selectedRole?.name} role permissions saved`);
                setEditRoleOpen(false);
              }}
              style={{backgroundColor: 'hsl(193, 55%, 45%)'}}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
