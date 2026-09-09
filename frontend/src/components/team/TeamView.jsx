import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Shield, Plus, Trophy, Edit, Trash2, Crown, UserCheck, User, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { teamAPI, leadsAPI, dealsAPI } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { PERMISSIONS as APP_PERMISSIONS, hasPermission } from '../../utils/permissions'
import { buildTeamLeaderboard } from '../../utils/liveMetrics'
import { fetchAllPages } from '../../utils/pagination'

const ROLE_CONFIG = {
  SUPER_ADMIN: { label: 'Super Admin', icon: Crown, cls: 'badge bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400' },
  COMPANY_ADMIN: { label: 'Company Admin', icon: Crown, cls: 'badge bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400' },
  ADMIN: { label: 'Admin', icon: Crown, cls: 'badge bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400' },
  MANAGER: { label: 'Manager', icon: UserCheck, cls: 'badge bg-brand-100 text-brand-700 dark:bg-brand-950/30 dark:text-brand-400' },
  SALES_EXEC: { label: 'Sales Exec', icon: User, cls: 'badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' },
  NORMAL_USER: { label: 'Normal User', icon: User, cls: 'badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' },
}

const ROLE_PERFORMANCE_LABEL = {
  SUPER_ADMIN: 'Super admin account',
  COMPANY_ADMIN: 'Company admin account',
  ADMIN: 'Admin account',
  MANAGER: 'Manager account',
  SALES_EXEC: 'Sales account',
  NORMAL_USER: 'Normal user account',
}

const ROLE_PERMISSION_LABELS = {
  SUPER_ADMIN: ['View all data', 'Manage users', 'Configure settings', 'View billing', 'All module access', 'Delete records'],
  COMPANY_ADMIN: ['View all data', 'Manage users', 'Configure settings', 'View billing', 'All module access', 'Delete records'],
  ADMIN: ['View all data', 'Manage users', 'Configure settings', 'View billing', 'All module access', 'Delete records'],
  MANAGER: ['View all data', 'Manage assigned team', 'View reports', 'Create campaigns', 'Export data'],
  SALES_EXEC: ['View own leads', 'Create & edit leads', 'Manage own deals', 'Log activities', 'View assigned customers'],
  NORMAL_USER: ['View own leads', 'Create & edit leads', 'Manage own deals', 'Log activities', 'View assigned customers'],
}

const buildPermissionState = () =>
  Object.fromEntries(
    Object.entries(ROLE_PERMISSION_LABELS).map(([role, permissions]) => [
      role,
      Object.fromEntries(permissions.map((permission) => [permission, true])),
    ])
  )

const MEMBER_FORM_INITIAL = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'SALES_EXEC',
  status: 'active',
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^\+?[0-9\s-]{7,15}$/

export default function TeamPage() {
  const { user } = useAuthStore()
  const [team, setTeam] = useState([])
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [liveLeaderboard, setLiveLeaderboard] = useState([])
  const [selectedRole, setSelectedRole] = useState('SALES_EXEC')
  const [permissionsByRole, setPermissionsByRole] = useState(buildPermissionState)
  const [memberModal, setMemberModal] = useState(null)
  const [memberForm, setMemberForm] = useState(MEMBER_FORM_INITIAL)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const canInvite = hasPermission(user, APP_PERMISSIONS.TEAM_INVITE)
  const canUpdate = hasPermission(user, APP_PERMISSIONS.TEAM_UPDATE)
  const canDeactivate = hasPermission(user, APP_PERMISSIONS.TEAM_DEACTIVATE)
  const canConfigure = hasPermission(user, APP_PERMISSIONS.SETTINGS_UPDATE)
  const isManager = user?.role === 'MANAGER'
  const isAdminLike = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'ADMIN'].includes(user?.role)
  const roleOptions = Object.keys(ROLE_CONFIG).filter((roleKey) => !isManager || !['SUPER_ADMIN', 'COMPANY_ADMIN', 'ADMIN'].includes(roleKey))

  useEffect(() => {
    let mounted = true
    const loadTeam = async () => {
      setLoadingTeam(true)
      try {
        const [users, leadRows, dealRows] = await Promise.all([
          teamAPI.getAll(),
          fetchAllPages((params) => leadsAPI.getAll(params), 250).then((result) => result.rows),
          fetchAllPages((params) => dealsAPI.getAll(params), 200).then((result) => result.rows),
        ])
        if (!mounted) return
        const normalized = (users ?? []).map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone || '',
          role: u.role || 'SALES_EXEC',
          status: u.isActive === false ? 'inactive' : 'active',
          leads: 0,
          deals: 0,
          avatar: (u.name || 'U').charAt(0).toUpperCase(),
          badge: '',
          joinedAt: '',
        }))
        setTeam(normalized)
        setLiveLeaderboard(buildTeamLeaderboard({ users, leads: leadRows, deals: dealRows }))
      } catch (err) {
        toast.error(err?.message || 'Failed to load team members')
      } finally {
        if (mounted) setLoadingTeam(false)
      }
    }

    loadTeam()
    return () => { mounted = false }
  }, [])

  const closeMemberModal = () => {
    setMemberModal(null)
    setMemberForm(MEMBER_FORM_INITIAL)
  }

  const openInviteModal = () => {
    if (!canInvite) {
      toast.error('You do not have permission to invite members.')
      return
    }
    setMemberForm(MEMBER_FORM_INITIAL)
    setMemberModal({ mode: 'add', memberId: null })
  }

  const openEditModal = (member) => {
    if (!canUpdate) {
      toast.error('You do not have permission to edit members.')
      return
    }
    if (isManager && ['SUPER_ADMIN', 'COMPANY_ADMIN', 'ADMIN'].includes(member.role)) {
      toast.error('Managers cannot edit elevated admin users.')
      return
    }
    setMemberForm({
      name: member.name,
      email: member.email,
      phone: member.phone || '',
      password: '',
      role: member.role,
      status: member.status,
    })
    setMemberModal({ mode: 'edit', memberId: member.id })
  }

  const getAdminCount = () => team.filter((member) => ['SUPER_ADMIN', 'COMPANY_ADMIN', 'ADMIN'].includes(member.role)).length

  const validateMemberForm = () => {
    const name = memberForm.name.trim()
    const email = memberForm.email.trim().toLowerCase()
    const phone = memberForm.phone.trim()
    const password = memberForm.password

    if (!name) {
      toast.error('Member name is required.')
      return null
    }
    if (!email) {
      toast.error('Member email is required.')
      return null
    }
    if (!EMAIL_REGEX.test(email)) {
      toast.error('Enter a valid email address.')
      return null
    }
    if (!phone) {
      toast.error('Phone number is required.')
      return null
    }
    if (!PHONE_REGEX.test(phone)) {
      toast.error('Enter a valid phone number.')
      return null
    }
    if (memberModal?.mode === 'add' && !password) {
      toast.error('Password is required for new members.')
      return null
    }
    if (password && password.length < 6) {
      toast.error('Password must be at least 6 characters.')
      return null
    }
    if (!ROLE_CONFIG[memberForm.role]) {
      toast.error('Select a valid role.')
      return null
    }
    if (isManager && ['SUPER_ADMIN', 'COMPANY_ADMIN', 'ADMIN'].includes(memberForm.role)) {
      toast.error('Managers can invite only Manager or Sales Executive.')
      return null
    }
    if (!['active', 'inactive'].includes(memberForm.status)) {
      toast.error('Select a valid status.')
      return null
    }

    const duplicateEmail = team.some((member) =>
      member.email.toLowerCase() === email &&
      member.id !== memberModal?.memberId
    )
    if (duplicateEmail) {
      toast.error('A member with this email already exists.')
      return null
    }

    return { name, email, phone, password }
  }

  const handleMemberSubmit = async (e) => {
    e.preventDefault()
    const validated = validateMemberForm()
    if (!validated) return

    const { name, email, phone, password } = validated
    const avatar = name.charAt(0).toUpperCase() || 'U'

    if (memberModal?.mode === 'add') {
      try {
        const created = await teamAPI.invite({
          name,
          email,
          phone,
          password,
          role: memberForm.role,
          isActive: memberForm.status === 'active',
        })
        setTeam((prev) => [
          ...prev,
          {
            id: created.id,
            name: created.name,
            email: created.email,
            phone: created.phone || '',
            role: created.role || memberForm.role,
            status: created.isActive === false ? 'inactive' : 'active',
            leads: 0,
            deals: 0,
            avatar,
            badge: '',
            joinedAt: '',
          },
        ])
        toast.success(`Member invited: ${name}`)
        closeMemberModal()
      } catch (err) {
        toast.error(err?.message || 'Failed to invite member')
      }
      return
    }

    const currentMember = team.find((member) => member.id === memberModal?.memberId)
    if (!currentMember) {
      toast.error('Member not found.')
      closeMemberModal()
      return
    }

    if (['SUPER_ADMIN', 'COMPANY_ADMIN', 'ADMIN'].includes(currentMember.role) && !['SUPER_ADMIN', 'COMPANY_ADMIN', 'ADMIN'].includes(memberForm.role) && getAdminCount() <= 1) {
      toast.error('At least one admin-like account is required.')
      return
    }

    try {
      const updatePayload = {
        name,
        email,
        phone,
        password: password || undefined,
      }
      if (isAdminLike) {
        updatePayload.role = memberForm.role
        updatePayload.isActive = memberForm.status === 'active'
      }

      const updated = await teamAPI.update(String(currentMember.id), updatePayload)
      setTeam((prev) =>
        prev.map((member) => {
          if (member.id !== currentMember.id) return member
          return {
            ...member,
            name: updated.name,
            email: updated.email,
            phone: updated.phone || '',
            role: updated.role || member.role,
            status: updated.isActive === false ? 'inactive' : 'active',
            avatar,
          }
        })
      )
      toast.success(`Updated ${name}`)
      closeMemberModal()
    } catch (err) {
      toast.error(err?.message || 'Failed to update member')
    }
  }

  const handleDeleteMember = (member) => {
    if (!canDeactivate) {
      toast.error('You do not have permission to deactivate members.')
      return
    }
    if (['SUPER_ADMIN', 'COMPANY_ADMIN', 'ADMIN'].includes(member.role) && getAdminCount() <= 1) {
      toast.error('Cannot delete the last admin-like account.')
      return
    }
    setDeleteTarget(member)
  }

  const confirmDeleteMember = async () => {
    if (!deleteTarget) return
    try {
      await teamAPI.delete(String(deleteTarget.id))
      setTeam((prev) => prev.filter((member) => member.id !== deleteTarget.id))
      toast.success(`Deleted ${deleteTarget.name}`)
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err?.message || 'Failed to delete member')
    }
  }

  const togglePermission = (role, permission) => {
    if (!canConfigure) {
      toast.error('You do not have permission to configure role permissions.')
      return
    }
    setPermissionsByRole((prev) => {
      const nextEnabled = !prev[role][permission]
      const next = {
        ...prev,
        [role]: {
          ...prev[role],
          [permission]: nextEnabled,
        },
      }
      toast.success(`${permission} ${nextEnabled ? 'enabled' : 'disabled'} for ${ROLE_CONFIG[role].label}`)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand-500" /> Team & Roles
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{team.length} members · Role-based access control</p>
        </div>
        {canInvite && (
          <button onClick={openInviteModal} className="btn-primary gap-1.5 text-sm">
            <Plus className="w-4 h-4" /> Invite Member
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team list */}
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="sm:hidden divide-y divide-slate-200/60 dark:divide-slate-700/40">
            {loadingTeam && (
              <div className="py-8 px-4 text-center text-slate-500">
                Loading team members...
              </div>
            )}
            {!loadingTeam && team.length === 0 && (
              <div className="py-8 px-4 text-center text-slate-500">
                No team members found.
              </div>
            )}
            {!loadingTeam && team.map((member) => {
              const roleCfg = ROLE_CONFIG[member.role]
              return (
                <div key={member.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-accent-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {member.avatar}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{member.name}</p>
                        <p className="text-xs text-slate-500 truncate">{member.email}</p>
                        <p className="text-xs text-slate-400 truncate">{member.phone}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={roleCfg?.cls}>{roleCfg?.label}</span>
                      <span className={`badge ${member.status === 'active' ? 'badge-won' : 'badge bg-slate-100 text-slate-500'}`}>
                        {member.status}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Performance</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                      {member.leads > 0 ? `${member.leads} leads · ${member.deals} deals` : (ROLE_PERFORMANCE_LABEL[member.role] || 'Sales account')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {canUpdate && (
                      <button
                        onClick={() => openEditModal(member)}
                        className="btn-secondary flex-1 text-xs gap-1.5"
                        aria-label={`Edit ${member.name}`}
                        title={`Edit ${member.name}`}
                      >
                        <Edit className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    {canDeactivate && (
                      <button
                        onClick={() => handleDeleteMember(member)}
                        className="btn-secondary flex-1 text-xs gap-1.5 text-red-600 dark:text-red-400"
                        aria-label={`Delete ${member.name}`}
                        title={`Delete ${member.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="hidden sm:table w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-slate-200/60 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-800/30">
                {['Member', 'Role', 'Status', 'Performance', 'Actions'].map((h) => (
                  <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/40">
              {loadingTeam && (
                <tr>
                  <td colSpan={5} className="py-8 px-4 text-center text-slate-500">
                    Loading team members...
                  </td>
                </tr>
              )}
              {!loadingTeam && team.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 px-4 text-center text-slate-500">
                    No team members found.
                  </td>
                </tr>
              )}
              {!loadingTeam && team.map((member) => {
                const roleCfg = ROLE_CONFIG[member.role]
                return (
                  <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-accent-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {member.avatar}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{member.name} {member.badge}</p>
                          <p className="text-xs text-slate-500">{member.email}</p>
                          <p className="text-xs text-slate-400">{member.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={roleCfg?.cls}>{roleCfg?.label}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${member.status === 'active' ? 'badge-won' : 'badge bg-slate-100 text-slate-500'}`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {member.leads > 0
                        ? `${member.leads} leads · ${member.deals} deals`
                        : (ROLE_PERFORMANCE_LABEL[member.role] || 'Sales account')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {canUpdate && (
                          <button
                            onClick={() => openEditModal(member)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-brand-500"
                            title={`Edit ${member.name}`}
                            aria-label={`Edit ${member.name}`}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeactivate && (
                          <button
                            onClick={() => handleDeleteMember(member)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-500"
                            title={`Delete ${member.name}`}
                            aria-label={`Delete ${member.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            </table>
          </div>
        </div>

        {/* Role Permissions */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Role Permissions</h2>
          <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
            {Object.keys(ROLE_PERMISSION_LABELS).map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`flex-1 min-w-[92px] py-1.5 text-xs font-medium rounded-lg transition-all
                  ${selectedRole === role ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm' : 'text-slate-500'}`}
              >
                {ROLE_CONFIG[role]?.label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {Object.keys(permissionsByRole[selectedRole]).map((perm) => (
              <div key={perm} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0
                    ${permissionsByRole[selectedRole][perm] ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}
                >
                  <div
                    className={`w-2 h-2 rounded-full
                      ${permissionsByRole[selectedRole][perm] ? 'bg-emerald-500' : 'bg-red-500'}`}
                  />
                </div>
                <span className={permissionsByRole[selectedRole][perm] ? '' : 'line-through opacity-70'}>{perm}</span>
                <button
                  onClick={() => togglePermission(selectedRole, perm)}
                  className={`ml-auto px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors
                    ${permissionsByRole[selectedRole][perm]
                      ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400'
                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400'
                    }`}
                >
                  {permissionsByRole[selectedRole][perm] ? 'Disable' : 'Enable'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Monthly Leaderboard</h2>
        </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {liveLeaderboard.map((member) => (
            <div key={member.name} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-center">
              <div className="text-4xl mb-2">{member.badge}</div>
              <p className="font-bold text-slate-800 dark:text-slate-200">{member.name}</p>
              <p className="text-2xl font-bold text-brand-600 dark:text-brand-400 mt-1">
                ₹{(member.revenue / 100000).toFixed(1)}L
              </p>
              <div className="flex justify-center gap-4 mt-2 text-xs text-slate-500">
                <span>{member.leads} leads</span>
                <span>{member.deals} deals</span>
                <span>{member.convRate}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {memberModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={memberModal.mode === 'add' ? 'Invite team member' : 'Edit team member'}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMemberModal}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative glass-card w-full max-w-lg p-6 z-10"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                  {memberModal.mode === 'add' ? 'Invite Member' : 'Edit Member'}
                </h2>
                <button onClick={closeMemberModal} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleMemberSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Full Name *</label>
                    <input
                      value={memberForm.name}
                      onChange={(e) => setMemberForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="input"
                      placeholder="Ramesh Patel"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Email *</label>
                    <input
                      type="email"
                      value={memberForm.email}
                      onChange={(e) => setMemberForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="input"
                      placeholder="ramesh@nexacrm.com"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Phone Number *</label>
                    <input
                      value={memberForm.phone}
                      onChange={(e) => setMemberForm((prev) => ({ ...prev, phone: e.target.value }))}
                      className="input"
                      placeholder="+91 9876543210"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Password {memberModal.mode === 'add' ? '*' : '(optional)'}
                    </label>
                    <input
                      type="password"
                      value={memberForm.password}
                      onChange={(e) => setMemberForm((prev) => ({ ...prev, password: e.target.value }))}
                      className="input"
                      placeholder={memberModal.mode === 'add' ? 'Enter password' : 'Leave blank to keep current password'}
                    />
                  </div>
                  {(memberModal.mode === 'add' || isAdminLike) && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Role</label>
                      <select
                        value={memberForm.role}
                        onChange={(e) => setMemberForm((prev) => ({ ...prev, role: e.target.value }))}
                        className="input"
                      >
                        {roleOptions.map((roleKey) => (
                          <option key={roleKey} value={roleKey}>{ROLE_CONFIG[roleKey].label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {(memberModal.mode === 'add' || isAdminLike) && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Status</label>
                      <select
                        value={memberForm.status}
                        onChange={(e) => setMemberForm((prev) => ({ ...prev, status: e.target.value }))}
                        className="input"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeMemberModal} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary flex-1">
                    {memberModal.mode === 'add' ? 'Invite Member' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Delete team member">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteTarget(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative glass-card w-full max-w-md p-6 z-10"
            >
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Delete Member</h2>
              <p className="text-sm text-slate-500 mt-2">
                Are you sure you want to remove <span className="font-semibold text-slate-700 dark:text-slate-300">{deleteTarget.name}</span> from the team?
              </p>
              <div className="flex gap-3 pt-5">
                <button type="button" onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancel</button>
                <button
                  type="button"
                  onClick={confirmDeleteMember}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
