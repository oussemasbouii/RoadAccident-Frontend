import { useEffect, useMemo, useState } from 'react'
import { Box, Dialog, DialogContent, Divider, List, ListItemButton, ListItemText, Stack, TextField, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { openThread, setActivePeer } from '@/features/chat/slices/chatSlice'
import { useTranslation } from '@/themeMode'

type CommandItem = {
  id: string
  label: string
  description?: string
  onSelect: () => void
  keywords?: string[]
}

export default function CommandBar() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const user = useAppSelector((state) => state.auth.user)
  const contacts = useAppSelector((state) => state.chat.contacts)
  const contactIds = useAppSelector((state) => state.chat.contactIds)
  const { t } = useTranslation()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const baseItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      {
        id: 'nav-dashboard',
        label: `${t('common.go_to')} ${t('nav.dashboard')}`,
        description: `${t('dashboard.overview')} · ${t('dashboard.subtitle')}`,
        onSelect: () => navigate('/dashboard'),
        keywords: ['home', 'overview'],
      },
      {
        id: 'nav-incidents',
        label: `${t('common.go_to')} ${t('nav.accidents')}`,
        description: t('incidents.subtitle'),
        onSelect: () => navigate('/incidents'),
      },
      {
        id: 'nav-alerts',
        label: `${t('common.go_to')} ${t('nav.alerts')}`,
        description: t('alerts.subtitle'),
        onSelect: () => navigate('/alerts'),
      },
      {
        id: 'nav-reports',
        label: `${t('common.go_to')} ${t('nav.reports')}`,
        description: t('reports.subtitle'),
        onSelect: () => navigate('/reports'),
      },
      {
        id: 'nav-communications',
        label: `${t('common.go_to')} ${t('nav.communications')}`,
        description: t('comms.subtitle'),
        onSelect: () => navigate('/communications'),
        keywords: ['messages', 'chat', 'comms'],
      },
      {
        id: 'nav-settings',
        label: `${t('common.go_to')} ${t('common.settings')}`,
        description: t('settings.subtitle'),
        onSelect: () => navigate('/settings'),
      },
    ]

    if (user?.role === 'admin') {
          items.push(
        {
          id: 'nav-admin-accounts',
          label: t('nav.user_accounts'),
          description: t('settings.title'),
          onSelect: () => navigate('/admin/accounts'),
        },
        {
          id: 'nav-officer-tracking',
          label: t('nav.officer_tracking'),
          description: t('comms.contacts'),
          onSelect: () => navigate('/admin/officer-tracking'),
        }
      )
    }

    return items
  }, [navigate, user?.role])

  const contactItems = useMemo<CommandItem[]>(() => {
    return contactIds.map((id: string) => {
      const contact = contacts[id]
      return {
        id: `chat-${id}`,
        label: `${t('nav.communications')}: ${contact?.name ?? t('common.people')}`,
        description: contact?.officerId ? `${t('topbar.id_label')}: ${contact.officerId}` : undefined,
        onSelect: () => {
          dispatch(openThread({ peerId: id }))
          dispatch(setActivePeer({ peerId: id }))
        },
        keywords: [contact?.name ?? '', contact?.officerId ?? '', contact?.role ?? ''],
      }
    })
  }, [contactIds, contacts, dispatch])

  const filteredNav = useMemo(() => {
    if (!query.trim()) return baseItems
    const needle = query.toLowerCase()
    return baseItems.filter((item) => {
      const hay = [item.label, item.description, ...(item.keywords ?? [])]
        .join(' ')
        .toLowerCase()
      return hay.includes(needle)
    })
  }, [baseItems, query])

  const filteredContacts = useMemo(() => {
    if (!query.trim()) return contactItems.slice(0, 6)
    const needle = query.toLowerCase()
    return contactItems.filter((item) => {
      const hay = [item.label, item.description, ...(item.keywords ?? [])]
        .join(' ')
        .toLowerCase()
      return hay.includes(needle)
    })
  }, [contactItems, query])

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
    >
      <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography sx={{ fontWeight: 700 }}>Command Bar</Typography>
          <Typography variant="caption" color="text.secondary">
            {t('common.esc_to_close')}
          </Typography>
        </Stack>
        <TextField
          autoFocus
          fullWidth
          placeholder={t('common.search_pages_or_people')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          size="small"
        />
      </Box>
      <DialogContent sx={{ p: 0 }}>
        {filteredNav.length === 0 && filteredContacts.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary">
              {t('common.no_results_found')}
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {filteredNav.length > 0 && (
              <>
                <Box sx={{ px: 2.5, py: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
                    {t('common.navigation')}
                  </Typography>
                </Box>
                {filteredNav.map((item) => (
                  <ListItemButton
                    key={item.id}
                    onClick={() => {
                      item.onSelect()
                      setOpen(false)
                      setQuery('')
                    }}
                    sx={{ px: 2.5, py: 1.1 }}
                  >
                    <ListItemText
                      primary={item.label}
                      secondary={item.description}
                      primaryTypographyProps={{ fontWeight: 700 }}
                    />
                  </ListItemButton>
                ))}
              </>
            )}

            {filteredContacts.length > 0 && (
              <>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ px: 2.5, py: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
                    {t('common.people')}
                  </Typography>
                </Box>
                {filteredContacts.map((item) => (
                  <ListItemButton
                    key={item.id}
                    onClick={() => {
                      item.onSelect()
                      setOpen(false)
                      setQuery('')
                    }}
                    sx={{ px: 2.5, py: 1 }}
                  >
                    <ListItemText
                      primary={item.label}
                      secondary={item.description}
                      primaryTypographyProps={{ fontWeight: 700 }}
                    />
                  </ListItemButton>
                ))}
              </>
            )}
          </List>
        )}
      </DialogContent>
    </Dialog>
  )
}
