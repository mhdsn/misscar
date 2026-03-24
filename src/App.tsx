import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format, differenceInDays, parseISO, startOfDay, addYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Car, CalendarDays, Plus, Search, Trash2, 
  ShieldAlert, ShieldCheck, Clock, LayoutDashboard, List,
  User, FileText, AlertCircle, CheckCircle2, Menu, X,
  ArrowRight, RefreshCw, Filter, Download, LogOut,
  Mail, Lock, Eye, EyeOff, Send, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { InsurancePolicy } from './types';
import { generateInvoice } from './utils/invoice';
import { supabase, signInWithEmail, signUpWithEmail, logOut } from './supabase';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loginName, setLoginName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Auth form state
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'add' | 'settings'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean, policyId: string | null}>({ isOpen: false, policyId: null });
  const [renewModal, setRenewModal] = useState<{isOpen: boolean, policy: InsurancePolicy | null}>({ isOpen: false, policy: null });
  const [viewModal, setViewModal] = useState<{isOpen: boolean, policy: InsurancePolicy | null}>({ isOpen: false, policy: null });
  const [renewDates, setRenewDates] = useState({ startDate: '', endDate: '', reminderDays: 7 });

  // Form state
  const [formData, setFormData] = useState({
    ownerName: '',
    clientEmail: '',
    carBrand: '',
    carModel: '',
    licensePlate: '',
    startDate: '',
    endDate: '',
    reminderDays: 7
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsAuthenticated(true);
        setUserId(session.user.id);
        setLoginName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Utilisateur');
        setLoginEmail(session.user.email || '');
      }
      setIsAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        setUserId(session.user.id);
        setLoginName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Utilisateur');
        setLoginEmail(session.user.email || '');
      } else {
        setIsAuthenticated(false);
        setUserId(null);
        setLoginName('');
        setLoginEmail('');
        setPolicies([]);
      }
      setIsAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleDbError = (error: any, operationType: string, table: string | null) => {
    const errMsg = error?.message || String(error);
    console.error(`Database Error [${operationType}] on ${table}:`, errMsg);
    toast.error("Erreur de base de données : " + errMsg);
  };

  useEffect(() => {
    if (!isAuthReady || !isAuthenticated || !userId) return;

    const fetchPolicies = async () => {
      const { data, error } = await supabase
        .from('policies')
        .select('*')
        .eq('userId', userId);
      if (error) {
        handleDbError(error, 'get', 'policies');
      } else {
        setPolicies(data as InsurancePolicy[]);
      }
    };

    fetchPolicies();

    const channel = supabase
      .channel('policies-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'policies',
        filter: `userId=eq.${userId}`
      }, () => {
        fetchPolicies();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthReady, isAuthenticated, userId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (authMode === 'signup') {
        if (!authFullName.trim()) {
          toast.error('Veuillez entrer votre nom complet');
          setAuthLoading(false);
          return;
        }
        const { user } = await signUpWithEmail(authEmail, authPassword, authFullName);
        if (user && !user.confirmed_at) {
          toast.success('Compte créé ! Vérifiez votre email pour confirmer votre inscription.');
        } else {
          toast.success('Compte créé et connecté !');
        }
      } else {
        await signInWithEmail(authEmail, authPassword);
        toast.success('Connexion réussie');
      }
    } catch (error: any) {
      const msg = error?.message || 'Erreur lors de la connexion';
      toast.error(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
      toast.success('Déconnexion réussie');
    } catch (error) {
      toast.error('Erreur lors de la déconnexion');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const newPolicy: InsurancePolicy = {
      id: uuidv4(),
      ...formData,
      reminderDays: Number(formData.reminderDays),
      createdAt: Date.now(),
      userId: userId
    };
    
    try {
      const { error } = await supabase.from('policies').insert(newPolicy);
      if (error) throw error;
      setFormData({
        ownerName: '',
        clientEmail: '',
        carBrand: '',
        carModel: '',
        licensePlate: '',
        startDate: '',
        endDate: '',
        reminderDays: 7
      });
      toast.success('Assurance enregistrée avec succès', {
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
        action: {
          label: 'Télécharger la facture',
          onClick: () => generateInvoice(newPolicy)
        }
      });
      setActiveTab('list');
    } catch (error) {
      handleDbError(error, 'create', 'policies');
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteModal({ isOpen: true, policyId: id });
  };

  const confirmDelete = async () => {
    if (deleteModal.policyId) {
      try {
        const { error } = await supabase.from('policies').delete().eq('id', deleteModal.policyId);
        if (error) throw error;
        toast.success('Assurance supprimée');
      } catch (error) {
        handleDbError(error, 'delete', 'policies');
      }
    }
    setDeleteModal({ isOpen: false, policyId: null });
  };

  const cancelDelete = () => {
    setDeleteModal({ isOpen: false, policyId: null });
  };

  const handleRenewClick = (policy: InsurancePolicy) => {
    const oldEndDate = parseISO(policy.endDate);
    setRenewDates({
      startDate: policy.endDate,
      endDate: format(addYears(oldEndDate, 1), 'yyyy-MM-dd'),
      reminderDays: policy.reminderDays ?? 7
    });
    setRenewModal({ isOpen: true, policy });
  };

  const handleSendReminder = async (policy: InsurancePolicy) => {
    if (!loginEmail) {
      toast.error("Impossible de déterminer votre adresse email.");
      return;
    }

    const loadingToast = toast.loading("Envoi du rappel en cours...");
    const daysLeft = differenceInDays(parseISO(policy.endDate), startOfDay(new Date()));
    try {
      const response = await fetch('/api/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: loginEmail,
          subject: `[Miss_Carr Assur] Rappel : Le contrat de ${policy.ownerName} expire ${daysLeft <= 0 ? "aujourd'hui" : `dans ${daysLeft} jour(s)`}`,
          text: `Bonjour,\n\nCeci est un rappel automatique de Miss_Carr Assur.\n\nLe contrat d'assurance suivant ${daysLeft <= 0 ? 'a expiré' : `expire dans ${daysLeft} jour(s)`} :\n\n- Client : ${policy.ownerName}\n- Véhicule : ${policy.carBrand} ${policy.carModel}\n- Plaque : ${policy.licensePlate}\n- Date d'expiration : ${format(parseISO(policy.endDate), 'dd/MM/yyyy')}\n${policy.clientEmail ? `- Email du client : ${policy.clientEmail}\n` : ''}\nMerci de prendre les dispositions nécessaires pour le renouvellement.\n\nCordialement,\nMiss_Carr Assur`
        })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success("Rappel envoyé avec succès !", { id: loadingToast });
        await supabase.from('policies').update({ notificationSent: true }).eq('id', policy.id);
      } else {
        throw new Error(data.error || "Erreur inconnue");
      }
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'envoi du rappel", { id: loadingToast });
    }
  };

  const exportToCSV = () => {
    if (filteredPolicies.length === 0) {
      toast.error("Aucun contrat à exporter.");
      return;
    }

    const headers = [
      "ID",
      "Nom du propriétaire",
      "Email du client",
      "Marque du véhicule",
      "Modèle du véhicule",
      "Plaque d'immatriculation",
      "Date de début",
      "Date de fin",
      "Jours restants",
      "Statut",
      "Rappel envoyé"
    ];

    const csvRows = [
      headers.join(';'),
      ...filteredPolicies.map(p => {
        return [
          p.id,
          `"${p.ownerName.replace(/"/g, '""')}"`,
          `"${(p.clientEmail || '').replace(/"/g, '""')}"`,
          `"${p.carBrand.replace(/"/g, '""')}"`,
          `"${p.carModel.replace(/"/g, '""')}"`,
          `"${p.licensePlate.replace(/"/g, '""')}"`,
          p.startDate,
          p.endDate,
          p.daysRemaining,
          p.status,
          p.notificationSent ? 'Oui' : 'Non'
        ].join(';');
      })
    ];

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `contrats_miss_carr_assur_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Export CSV réussi !");
  };

  useEffect(() => {
    if (!isAuthenticated || !loginEmail || policies.length === 0) return;

    const checkAndSendReminders = async () => {
      for (const p of policies) {
        const daysRemaining = differenceInDays(parseISO(p.endDate), startOfDay(new Date()));
        const reminderThreshold = p.reminderDays ?? 7;

        if (daysRemaining >= 0 && daysRemaining <= reminderThreshold && !p.notificationSent) {
          try {
            const response = await fetch('/api/send-reminder', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: loginEmail,
                subject: `[Miss_Carr Assur] Rappel : Le contrat de ${p.ownerName} expire dans ${daysRemaining} jour(s)`,
                text: `Bonjour,\n\nCeci est un rappel automatique de Miss_Carr Assur.\n\nLe contrat d'assurance suivant expire dans ${daysRemaining} jour(s) :\n\n- Client : ${p.ownerName}\n- Véhicule : ${p.carBrand} ${p.carModel}\n- Plaque : ${p.licensePlate}\n- Date d'expiration : ${format(parseISO(p.endDate), 'dd/MM/yyyy')}\n${p.clientEmail ? `- Email du client : ${p.clientEmail}\n` : ''}\nMerci de prendre les dispositions nécessaires pour le renouvellement.\n\nCordialement,\nMiss_Carr Assur`
              })
            });
            if (response.ok) {
              await supabase.from('policies').update({ notificationSent: true }).eq('id', p.id);
              toast.success(`Rappel envoyé : contrat de ${p.ownerName} expire bientôt`);
            }
          } catch (e) {
            console.error("Auto-reminder failed:", e);
          }
        }
      }
    };

    checkAndSendReminders();
  }, [isAuthenticated, policies, loginEmail]);

  const confirmRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (renewModal.policy) {
      const updatedPolicy = { 
        ...renewModal.policy, 
        startDate: renewDates.startDate, 
        endDate: renewDates.endDate, 
        reminderDays: Number(renewDates.reminderDays), 
        notificationSent: false 
      };
      try {
        const { error } = await supabase.from('policies').update({
          startDate: updatedPolicy.startDate,
          endDate: updatedPolicy.endDate,
          reminderDays: updatedPolicy.reminderDays,
          notificationSent: updatedPolicy.notificationSent
        }).eq('id', updatedPolicy.id);
        if (error) throw error;
        toast.success('Assurance renouvelée avec succès', {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
          action: {
            label: 'Télécharger la facture',
            onClick: () => generateInvoice(updatedPolicy)
          }
        });
      } catch (error) {
        handleDbError(error, 'update', 'policies');
      }
    }
    setRenewModal({ isOpen: false, policy: null });
  };

  const cancelRenew = () => {
    setRenewModal({ isOpen: false, policy: null });
  };

  const today = startOfDay(new Date());

  const enrichedPolicies = useMemo(() => {
    return policies.map(policy => {
      const endDate = parseISO(policy.endDate);
      const daysRemaining = differenceInDays(endDate, today);
      const reminderThreshold = policy.reminderDays ?? 7;
      
      let status: 'active' | 'expiring' | 'expired' = 'active';
      if (daysRemaining < 0) {
        status = 'expired';
      } else if (daysRemaining <= reminderThreshold) {
        status = 'expiring';
      }

      return {
        ...policy,
        daysRemaining,
        status
      };
    }).sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [policies, today]);



  const filteredPolicies = useMemo(() => {
    return enrichedPolicies.filter(p => {
      const matchesSearch = p.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.licensePlate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.carBrand.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [enrichedPolicies, searchQuery, statusFilter]);

  const stats = {
    total: policies.length,
    active: enrichedPolicies.filter(p => p.status === 'active').length,
    expiring: enrichedPolicies.filter(p => p.status === 'expiring').length,
    expired: enrichedPolicies.filter(p => p.status === 'expired').length,
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const renderDashboard = () => (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">Tableau de bord</h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">Bienvenue. Voici un résumé de vos dossiers d'assurance.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center px-3 sm:px-4 py-2 sm:py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Exporter CSV</span>
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className="flex items-center px-3 sm:px-4 py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Nouvelle assurance</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="p-2.5 sm:p-3 rounded-xl bg-indigo-50 text-indigo-600">
              <FileText className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mb-1">Total Assurances</p>
          <p className="text-2xl sm:text-3xl font-display font-bold text-slate-900">{stats.total}</p>
        </div>
        
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mb-1">Actives</p>
          <p className="text-2xl sm:text-3xl font-display font-bold text-slate-900">{stats.active}</p>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="p-2.5 sm:p-3 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mb-1">À renouveler (Bientôt)</p>
          <p className="text-2xl sm:text-3xl font-display font-bold text-slate-900">{stats.expiring}</p>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="p-2.5 sm:p-3 rounded-xl bg-red-50 text-red-600">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mb-1">Expirées</p>
          <p className="text-2xl sm:text-3xl font-display font-bold text-slate-900">{stats.expired}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-lg font-display font-semibold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Rappels Urgents
            </h3>
            <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
              {stats.expiring + stats.expired}
            </span>
          </div>
          <div className="divide-y divide-slate-100 flex-1">
            {enrichedPolicies.filter(p => p.status === 'expiring' || p.status === 'expired').length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center h-full">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-slate-900 font-medium">Tout est en ordre !</p>
                <p className="text-slate-500 text-sm mt-1">Aucune assurance n'est sur le point d'expirer.</p>
              </div>
            ) : (
              enrichedPolicies.filter(p => p.status === 'expiring' || p.status === 'expired').map(policy => (
                <div
                  key={policy.id}
                  className="p-4 sm:p-6 flex items-start sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors group cursor-pointer"
                  onClick={() => setViewModal({ isOpen: true, policy })}
                >
                  <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-display font-semibold border border-slate-200 shrink-0 text-sm sm:text-base">
                      {getInitials(policy.ownerName)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate">{policy.ownerName}</h3>
                      <p className="text-xs sm:text-sm text-slate-500 truncate">{policy.carBrand} {policy.carModel} • <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{policy.licensePlate}</span></p>
                      <div className="flex items-center mt-1 sm:mt-1.5 text-xs sm:text-sm">
                        <span className={`font-medium flex items-center ${policy.status === 'expired' ? 'text-red-600' : 'text-amber-600'}`}>
                          {policy.status === 'expired' ? <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" /> : <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />}
                          {policy.daysRemaining < 0
                            ? `Expiré depuis ${Math.abs(policy.daysRemaining)} j`
                            : policy.daysRemaining === 0
                              ? "Expire aujourd'hui"
                              : `Expire dans ${policy.daysRemaining} j`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRenewClick(policy); }}
                      className="p-1.5 sm:p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                      title="Renouveler"
                    >
                      <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setViewModal({ isOpen: true, policy }); }}
                      className="p-1.5 sm:p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                      title="Voir les détails"
                    >
                      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Add Card */}
        <div className="bg-indigo-600 rounded-2xl shadow-sm p-8 text-white flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-24 h-24 bg-indigo-900/20 rounded-full blur-xl"></div>
          
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-6 backdrop-blur-sm">
              <Car className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-2xl font-display font-bold mb-2">Nouveau Client ?</h3>
            <p className="text-indigo-100 mb-8">Enregistrez rapidement un nouveau contrat d'assurance pour ne manquer aucun renouvellement.</p>
            <button 
              onClick={() => setActiveTab('add')}
              className="w-full bg-white text-indigo-600 hover:bg-indigo-50 font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center shadow-sm"
            >
              <Plus className="w-5 h-5 mr-2" />
              Ajouter une assurance
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderList = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">Liste des contrats</h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">Gérez l'ensemble de vos dossiers d'assurance.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center px-3 sm:px-4 py-2 sm:py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Exporter CSV</span>
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className="flex items-center px-3 sm:px-4 py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Nouveau contrat</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher un client, plaque, véhicule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full transition-all text-sm"
            />
          </div>
          <div className="relative sm:w-48">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full transition-all text-sm appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actives</option>
              <option value="expiring">À renouveler</option>
              <option value="expired">Expirées</option>
            </select>
          </div>
        </div>

        {/* Empty state */}
        {filteredPolicies.length === 0 && (
          <div className="px-6 py-12 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-900 font-medium">Aucun résultat</p>
              <p className="text-slate-500 text-sm mt-1">Essayez de modifier votre recherche.</p>
            </div>
          </div>
        )}

        {/* Mobile card layout */}
        {filteredPolicies.length > 0 && (
          <div className="md:hidden divide-y divide-slate-100">
            {filteredPolicies.map(policy => (
              <div
                key={policy.id}
                className="p-4 hover:bg-slate-50/50 transition-colors cursor-pointer"
                onClick={() => setViewModal({ isOpen: true, policy })}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-display font-semibold shrink-0">
                      {getInitials(policy.ownerName)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{policy.ownerName}</div>
                      <div className="text-sm text-slate-500 truncate">{policy.carBrand} {policy.carModel}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRenewClick(policy); }}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                      title="Renouveler"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteClick(policy.id); }}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 ml-[52px]">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 font-mono border border-slate-200">
                    {policy.licensePlate}
                  </span>
                  {policy.status === 'active' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20">
                      <ShieldCheck className="w-3 h-3 mr-1" /> Active
                    </span>
                  )}
                  {policy.status === 'expiring' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-600/20">
                      <Clock className="w-3 h-3 mr-1" /> Expire bientôt
                    </span>
                  )}
                  {policy.status === 'expired' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-600/20">
                      <ShieldAlert className="w-3 h-3 mr-1" /> Expirée
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-2 ml-[52px] text-xs text-slate-500">
                  <span className="flex items-center">
                    <CalendarDays className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    {format(parseISO(policy.startDate), 'dd/MM/yyyy')}
                  </span>
                  <span className="flex items-center">
                    <ArrowRight className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    {format(parseISO(policy.endDate), 'dd/MM/yyyy')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Desktop table layout */}
        {filteredPolicies.length > 0 && (
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="px-6 py-4 font-semibold">Client</th>
                  <th className="px-6 py-4 font-semibold">Véhicule</th>
                  <th className="px-6 py-4 font-semibold">Période</th>
                  <th className="px-6 py-4 font-semibold">Statut</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPolicies.map(policy => (
                  <tr
                    key={policy.id}
                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                    onClick={() => setViewModal({ isOpen: true, policy })}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-display font-semibold">
                          {getInitials(policy.ownerName)}
                        </div>
                        <div className="font-medium text-slate-900">{policy.ownerName}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-900 font-medium">{policy.carBrand} <span className="text-slate-500 font-normal">{policy.carModel}</span></div>
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 font-mono border border-slate-200">
                          {policy.licensePlate}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-slate-600 mb-1">
                        <CalendarDays className="w-4 h-4 mr-2 text-slate-400" />
                        {format(parseISO(policy.startDate), 'dd/MM/yyyy')}
                      </div>
                      <div className="flex items-center text-sm text-slate-900 font-medium">
                        <ArrowRight className="w-4 h-4 mr-2 text-slate-400" />
                        {format(parseISO(policy.endDate), 'dd/MM/yyyy')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {policy.status === 'active' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20">
                          <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Active
                        </span>
                      )}
                      {policy.status === 'expiring' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-600/20">
                          <Clock className="w-3.5 h-3.5 mr-1" /> Expire bientôt
                        </span>
                      )}
                      {policy.status === 'expired' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-600/20">
                          <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Expirée
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRenewClick(policy); }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                          title="Renouveler"
                        >
                          <RefreshCw className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(policy.id); }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderAddForm = () => (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">Nouvelle Assurance</h1>
        <p className="text-slate-500 mt-1 text-sm sm:text-base">Enregistrez un nouveau contrat dans le système.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8">
          
          {/* Section Client */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center">
              <User className="w-4 h-4 mr-2 text-indigo-500" />
              Informations du Client
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ownerName" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nom complet du propriétaire
                </label>
                <input
                  type="text"
                  id="ownerName"
                  name="ownerName"
                  required
                  value={formData.ownerName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all sm:text-sm"
                  placeholder="Ex: Miss_Carr Assur"
                />
              </div>
              <div>
                <label htmlFor="clientEmail" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email du client (pour les rappels)
                </label>
                <input
                  type="email"
                  id="clientEmail"
                  name="clientEmail"
                  value={formData.clientEmail}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all sm:text-sm"
                  placeholder="Ex: client@email.com"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Section Véhicule */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center">
              <Car className="w-4 h-4 mr-2 text-indigo-500" />
              Détails du Véhicule
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="carBrand" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Marque
                </label>
                <input
                  type="text"
                  id="carBrand"
                  name="carBrand"
                  required
                  value={formData.carBrand}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all sm:text-sm"
                  placeholder="Ex: Toyota"
                />
              </div>
              <div>
                <label htmlFor="carModel" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Modèle
                </label>
                <input
                  type="text"
                  id="carModel"
                  name="carModel"
                  required
                  value={formData.carModel}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all sm:text-sm"
                  placeholder="Ex: Corolla"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="licensePlate" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Carte Grise (Immatriculation)
                </label>
                <input
                  type="text"
                  id="licensePlate"
                  name="licensePlate"
                  required
                  value={formData.licensePlate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all uppercase font-mono sm:text-sm"
                  placeholder="XX-999-YY"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Section Contrat */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center">
              <CalendarDays className="w-4 h-4 mr-2 text-indigo-500" />
              Période de Couverture
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Date de début
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  required
                  value={formData.startDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Date de fin
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  required
                  value={formData.endDate}
                  onChange={handleInputChange}
                  min={formData.startDate}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all sm:text-sm"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Section Rappel */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 text-indigo-500" />
              Préférences de Rappel
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="reminderDays" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Me rappeler avant l'expiration (en jours)
                </label>
                <input
                  type="number"
                  id="reminderDays"
                  name="reminderDays"
                  required
                  min="1"
                  max="365"
                  value={formData.reminderDays}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all sm:text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className="px-5 py-2.5 text-slate-700 hover:bg-slate-200/50 rounded-xl font-medium transition-colors text-sm"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-sm transition-colors flex items-center text-sm"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Enregistrer le contrat
          </button>
        </div>
      </form>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">Paramètres</h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">Configurez vos préférences.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-2xl">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            <Mail className="w-5 h-5 mr-2 text-indigo-600" />
            Rappels automatiques par email
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Lorsqu'un contrat arrive à expiration (7 jours par défaut), un email de rappel est envoyé automatiquement à votre adresse <strong className="text-slate-700">{loginEmail}</strong>.
          </p>
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
              <div className="text-sm text-indigo-800">
                <p className="font-medium mb-1">Configuration serveur requise</p>
                <p>Les identifiants Gmail pour l'envoi des emails sont configurés dans le fichier <code className="bg-indigo-100 px-1.5 py-0.5 rounded text-xs">.env.local</code> du serveur :</p>
                <ul className="mt-2 space-y-1 text-xs">
                  <li><code className="bg-indigo-100 px-1.5 py-0.5 rounded">VITE_GMAIL_USER</code> — votre adresse Gmail</li>
                  <li><code className="bg-indigo-100 px-1.5 py-0.5 rounded">VITE_GMAIL_APP_PASSWORD</code> — mot de passe d'application Google</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'list', label: 'Liste des contrats', icon: List },
    { id: 'add', label: 'Nouvelle assurance', icon: Plus },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ] as const;

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden items-center justify-center p-4">
        <Toaster position="top-right" richColors />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100"
        >
          <div className="text-center mb-8">
            <div className="inline-flex bg-indigo-600 p-3.5 rounded-2xl shadow-lg shadow-indigo-600/30 mb-5">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">Miss_Carr Assur</h1>
            <p className="text-slate-500 mt-2 text-sm">
              {authMode === 'login' ? 'Connectez-vous pour accéder à votre espace personnel.' : 'Créez votre compte pour commencer.'}
            </p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            {authMode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom complet</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                  <input
                    type="text"
                    value={authFullName}
                    onChange={(e) => setAuthFullName(e.target.value)}
                    placeholder="Jean Dupont"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-11 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl shadow-sm shadow-indigo-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : authMode === 'login' ? (
                <>
                  <ArrowRight className="w-4 h-4" />
                  Se connecter
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Créer mon compte
                </>
              )}
            </button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              {authMode === 'login' ? "Pas encore de compte ?" : "Déjà un compte ?"}
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                className="ml-1 text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
              >
                {authMode === 'login' ? "Créer un compte" : "Se connecter"}
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <Toaster position="top-right" richColors />
      
      <AnimatePresence>
        {deleteModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={cancelDelete}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden z-10"
            >
              <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900 mb-2">Supprimer l'assurance</h3>
                <p className="text-slate-500">
                  Êtes-vous sûr de vouloir supprimer ce contrat d'assurance ? Cette action est irréversible.
                </p>
              </div>
              <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  onClick={cancelDelete}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-200/50 rounded-xl font-medium transition-colors text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium shadow-sm transition-colors text-sm"
                >
                  Supprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {renewModal.isOpen && renewModal.policy && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={cancelRenew}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden z-10"
            >
              <form onSubmit={confirmRenew}>
                <div className="p-6">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
                    <RefreshCw className="w-6 h-6 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-display font-bold text-slate-900 mb-2">Renouveler l'assurance</h3>
                  <p className="text-slate-500 mb-6">
                    Renouvellement pour le véhicule <span className="font-medium text-slate-700">{renewModal.policy.carBrand} {renewModal.policy.carModel}</span> de <span className="font-medium text-slate-700">{renewModal.policy.ownerName}</span>.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nouvelle date de début</label>
                      <input
                        type="date"
                        required
                        value={renewDates.startDate}
                        onChange={e => setRenewDates({...renewDates, startDate: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nouvelle date de fin</label>
                      <input
                        type="date"
                        required
                        value={renewDates.endDate}
                        onChange={e => setRenewDates({...renewDates, endDate: e.target.value})}
                        min={renewDates.startDate}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Me rappeler avant (jours)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="365"
                        value={renewDates.reminderDays}
                        onChange={e => setRenewDates({...renewDates, reminderDays: Number(e.target.value)})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={cancelRenew}
                    className="px-4 py-2 text-slate-700 hover:bg-slate-200/50 rounded-xl font-medium transition-colors text-sm"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-sm transition-colors text-sm"
                  >
                    Confirmer le renouvellement
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Details Modal */}
      <AnimatePresence>
        {viewModal.isOpen && viewModal.policy && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewModal({ isOpen: false, policy: null })}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden z-10"
            >
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100">
                <h3 className="text-lg font-display font-bold text-slate-900">Détails du contrat</h3>
                <button
                  onClick={() => setViewModal({ isOpen: false, policy: null })}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-display font-bold text-lg sm:text-xl border border-indigo-100">
                    {getInitials(viewModal.policy.ownerName)}
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-slate-900">{viewModal.policy.ownerName}</h4>
                    <p className="text-slate-500 font-medium">{viewModal.policy.carBrand} {viewModal.policy.carModel}</p>
                    {viewModal.policy.clientEmail && (
                      <p className="text-sm text-slate-400 mt-0.5 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        {viewModal.policy.clientEmail}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <h4 className="text-sm font-medium text-slate-500 mb-1">Plaque d'immatriculation</h4>
                    <p className="text-base font-medium text-slate-900 font-mono bg-white px-2 py-1 rounded inline-block border border-slate-200">{viewModal.policy.licensePlate}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-500 mb-1">Statut</h4>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        viewModal.policy.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        viewModal.policy.status === 'expiring' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {viewModal.policy.status === 'active' ? 'Active' :
                         viewModal.policy.status === 'expiring' ? 'À renouveler' : 'Expirée'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-slate-500 mb-1">Date de début</h4>
                    <div className="flex items-center text-slate-900 font-medium">
                      <CalendarDays className="w-4 h-4 mr-2 text-slate-400" />
                      {format(parseISO(viewModal.policy.startDate), 'dd MMM yyyy', { locale: fr })}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-500 mb-1">Date de fin</h4>
                    <div className="flex items-center text-slate-900 font-medium">
                      <ArrowRight className="w-4 h-4 mr-2 text-slate-400" />
                      {format(parseISO(viewModal.policy.endDate), 'dd MMM yyyy', { locale: fr })}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-slate-500 mb-1">Préférence de rappel</h4>
                    <p className="text-slate-900 font-medium">{viewModal.policy.reminderDays ?? 7} jours avant expiration</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 px-4 sm:px-6 py-4 flex flex-wrap justify-end gap-2 sm:gap-3 border-t border-slate-100">
                {viewModal.policy.clientEmail && (
                  <button
                    onClick={() => handleSendReminder(viewModal.policy!)}
                    disabled={viewModal.policy.notificationSent}
                    className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-xl transition-colors flex items-center gap-1.5 ${
                      viewModal.policy.notificationSent
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200'
                    }`}
                    title={viewModal.policy.notificationSent ? "Rappel déjà envoyé" : "Envoyer un rappel par email"}
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {viewModal.policy.notificationSent ? "Envoyé" : "Rappel"}
                    </span>
                  </button>
                )}
                <button
                  onClick={() => generateInvoice(viewModal.policy)}
                  className="px-3 sm:px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 bg-white border border-slate-200 rounded-xl transition-colors flex items-center"
                >
                  <Download className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Facture</span>
                </button>
                <button
                  onClick={() => {
                    setViewModal({ isOpen: false, policy: null });
                    handleRenewClick(viewModal.policy!);
                  }}
                  className="px-3 sm:px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 bg-white border border-indigo-200 rounded-xl transition-colors flex items-center"
                >
                  <RefreshCw className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Renouveler</span>
                </button>
                <button
                  onClick={() => setViewModal({ isOpen: false, policy: null })}
                  className="px-3 sm:px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={`fixed lg:static inset-y-0 left-0 w-72 bg-white border-r border-slate-200 z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-sm shadow-indigo-600/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-display font-bold text-slate-900 tracking-tight">Miss_Carr Assur</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-2 text-slate-400 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5">
          <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Menu Principal</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-700 font-medium' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 m-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-display font-bold border border-indigo-200">
              {loginName ? getInitials(loginName) : 'M'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{loginName || 'Mon Garage'}</p>
              <p className="text-xs text-slate-500 truncate">Espace personnel</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-slate-900">Miss_Carr Assur</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full"
            >
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'list' && renderList()}
              {activeTab === 'add' && renderAddForm()}
              {activeTab === 'settings' && renderSettings()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
