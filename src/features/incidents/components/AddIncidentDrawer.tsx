import { useMemo, useState, useEffect } from 'react'
import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  GridLegacy as Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  FormControlLabel,
  TextField,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import AccidentLocationMap from '@/components/Common/AccidentLocationMap'
import IncidentDocumentsPanel from './IncidentDocumentsPanel'

export interface AddIncidentDrawerProps {
  open: boolean
  onClose: () => void
  onSubmit?: (payload: any) => Promise<any> | any
  error?: string | null
  mode?: 'create' | 'edit'
  initialData?: any | null
}

const DAY_TYPE_OPTIONS = ['WORKING', 'BEFORE_HOLIDAY', 'HOLIDAY', 'AFTER_HOLIDAY']
const ACCIDENT_SITUATION_OPTIONS = ['ON_ROAD', 'ON_SHOULDER', 'ON_VERGE', 'ON_SIDEWALK', 'ON_BIKE_PATH', 'ON_BIKE_LANE', 'OFF_PLATFORM']
const ZONE_OPTIONS = ['ROAD', 'URBAN', 'CROSSING', 'BYPASS']
const URBANITY_OPTIONS = ['IN_AGGLOMERATION', 'OUTSIDE_AGGLOMERATION']
const ROAD_SINUOSITY_OPTIONS = ['UNIQUE', 'RIGHT', 'LEFT', 'RIGHT_LEFT', 'LEFT_RIGHT', 'RIGHT_LEFT_RIGHT', 'LEFT_RIGHT_LEFT']
const ROAD_MARKING_OPTIONS = ['NONEXISTENT', 'LANE_SEPARATION', 'LANE_AND_EDGE', 'EDGE_ONLY']
const PLAN_LAYOUT_OPTIONS = ['STRAIGHT', 'GENTLE_CURVE', 'DIFFICULT_CURVE_NO_SIGN', 'DIFFICULT_CURVE_WITH_SIGN']
const ROAD_TYPE_OPTIONS = ['TOLL_HIGHWAY', 'FREE_HIGHWAY', 'EXPRESS', 'DUAL_CARRIAGEWAY', 'CONVENTIONAL_2X1', 'CONVENTIONAL_ADDITIONAL', 'INTERCHANGE_RAMP', 'CONTRAFLOW', 'AGRICULTURAL', 'SERVICE', 'OTHER']
const NETWORK_CATEGORY_OPTIONS = ['HIGHWAY', 'NATIONAL', 'REGIONAL', 'LOCAL', 'COMMUNAL', 'UNCLASSIFIED', 'AGRICULTURAL', 'OTHER']
const TRAFFIC_REGIME_OPTIONS = ['ONE_WAY', 'BIDIRECTIONAL', 'SEPARATED', 'VARIABLE']
const TRAFFIC_DIRECTION_OPTIONS = ['INCREASING', 'DECREASING', 'BOTH', 'UNKNOWN']
const ROAD_WIDTH_OPTIONS = ['GREATER_375', 'FROM_325_TO_375', 'LESS_325']
const LANE_WIDTH_OPTIONS = ['LESS_6', 'FROM_6_TO_7', 'GREATER_OR_EQUAL_7']
const LUMINOSITY_OPTIONS = ['FULL_DAYLIGHT', 'TWILIGHT_DAWN', 'NIGHT_NO_PUBLIC_LIGHTING', 'NIGHT_LIGHTING_OFF', 'NIGHT_LIGHTING_ON', 'NIGHT_SUFFICIENT_LIGHTING', 'INSUFFICIENT']
const ATMOSPHERIC_OPTIONS = ['GOOD_WEATHER', 'LIGHT_RAIN', 'HEAVY_RAIN', 'FOG_SMOKE', 'WIND', 'SNOW', 'OTHER']
const VISIBILITY_OPTIONS = ['CLEAR', 'NOT_CLEAR', 'FOG', 'NIGHT', 'OTHER']
const ROAD_PAVEMENT_OPTIONS = ['PAVED', 'UNPAVED']
const PARTICIPANT_TYPE_OPTIONS = ['DRIVER', 'PASSENGER', 'PEDESTRIAN', 'OWNER', 'WITNESS', 'LEGAL_GUARDIAN', 'ESCORT', 'DISPUTE_RESOLUTION_AGENT', 'COMPANION']
const VEHICLE_TYPE_OPTIONS = ['BICYCLE', 'MOPED', 'QUAD_50', 'TRICYCLE', 'MOTO_50_125', 'MOTO_125', 'QUAD_50_PLUS', 'VEHICLE_ALONE', 'VEHICLE_TRAILER', 'AGRICULTURAL_MACHINE', 'AGRICULTURAL_TRACTOR_NO_TRAILER', 'AGRICULTURAL_TRACTOR_TRAILER', 'LIGHT_TRUCK_3_5T', 'LIGHT_TRUCK_TRAILER', 'VAN', 'PL_3_5_7_5T', 'PL_7_5T_PLUS', 'PL_TRAILER', 'ROAD_TRACTOR_ALONE', 'ROAD_TRACTOR_SEMI_TRAILER', 'BUS_LINE', 'BUS_OTHER', 'TRAIN', 'LIGHT_METRO', 'TOWED_VEHICLE', 'PUSHED_VEHICLE', 'CART', 'ANIMAL', 'SPECIAL_EQUIPMENT', 'OTHER', 'UNKNOWN']
const SPECIAL_TYPE_OPTIONS = ['TAXI', 'LOUAGE', 'AMBULANCE', 'FIREFIGHTER', 'POLICE', 'SCHOOL_TRANSPORT', 'DANGEROUS_GOODS', 'ROAD_MAINTENANCE', 'NONE']
const INSURANCE_OPTIONS = ['YES', 'NO', 'NOT_PRESENT']
const VEHICLE_POSITION_OPTIONS = ['FRONT_LEFT', 'FRONT_RIGHT', 'REAR_LEFT', 'REAR_RIGHT', 'REAR_CENTER', 'OTHER']
const PEDESTRIAN_LOCATION_OPTIONS = ['CROSSWALK', 'OUTSIDE_CROSSWALK', 'SIDEWALK', 'SHOULDER', 'ROAD', 'OTHER']
const ACTION_OPTIONS = ['DRIVER_STRAIGHT', 'DRIVER_TURN_LEFT', 'DRIVER_TURN_RIGHT', 'DRIVER_OVERTAKING', 'DRIVER_REVERSING', 'DRIVER_STOPPING', 'DRIVER_PARKING', 'DRIVER_OTHER', 'PEDESTRIAN_CROSSING', 'PEDESTRIAN_WALKING_SAME_DIRECTION', 'PEDESTRIAN_WALKING_OPPOSITE_DIRECTION', 'PEDESTRIAN_STANDING', 'PEDESTRIAN_RUNNING', 'PEDESTRIAN_OTHER']
const TRAVEL_REASON_OPTIONS = ['HOME_WORK', 'WORK_HOME', 'PROFESSIONAL', 'SCHOOL', 'SHOPPING', 'LEISURE', 'OTHER']
const PLANNED_TRIP_OPTIONS = ['LESS_5KM', 'FROM_5_TO_25KM', 'FROM_25_TO_50KM', 'FROM_50_TO_100KM', 'MORE_100KM', 'UNKNOWN']
const SAFETY_OPTIONS = ['SEATBELT', 'HELMET', 'CHILD_SEAT', 'NONE', 'UNKNOWN']
const INJURY_OPTIONS = ['UNINJURED', 'LIGHT_INJURY', 'SERIOUS_INJURY', 'FATAL']
const ALCOHOL_OPTIONS = ['NOT_DONE', 'NEGATIVE', 'POSITIVE', 'REFUSED']
const DRUG_OPTIONS = ['NOT_DONE', 'NEGATIVE', 'POSITIVE', 'REFUSED']
const INFRACTION_OPTIONS = ['NONE', 'SPEEDING', 'RED_LIGHT', 'STOP_SIGN', 'WRONG_WAY', 'NO_LICENSE', 'EXPIRED_LICENSE', 'NO_INSURANCE', 'DUI', 'PHONE_USE', 'OTHER']
const ACCIDENT_CAUSE_OPTIONS = ['INATTENTION', 'INAPPROPRIATE_SPEED', 'INFRACTION', 'INEXPERIENCE', 'FATIGUE', 'ALCOHOL_DRUGS', 'ILLNESS', 'ROAD_CONDITION', 'SIGNAGE_CONDITION', 'VEHICLE_CONDITION', 'BREAKDOWN', 'OVERLOAD', 'ADVERSE_WEATHER', 'GLARE', 'ANIMAL', 'OTHER', 'NO_OPINION']
const ACCIDENT_TYPE_OPTIONS = ['COLLISION_MOVING', 'COLLISION_OBSTACLE', 'COLLISION_PEDESTRIAN_ANIMAL', 'ROLLOVER_ON_ROADWAY', 'RUNOFF_LEFT_COLLISION', 'RUNOFF_RIGHT_COLLISION', 'RUNOFF_LEFT_NO_COLLISION', 'RUNOFF_RIGHT_NO_COLLISION', 'OTHER']
const ACCIDENT_SUBTYPE_OPTIONS = ['FRONT', 'REAR', 'SIDE', 'FRONT_SIDE', 'CHAIN', 'MULTIPLE', 'PARKED_VEHICLE', 'SAFETY_BARRIER', 'LEVEL_CROSSING_BARRIER', 'SIGNAL_SUPPORT', 'ISLAND_REFUGE', 'OTHER_OBJECT', 'PEDESTRIAN_GROUP', 'PEDESTRIAN_BICYCLE', 'PEDESTRIAN_REPAIR', 'ANIMAL_DRIVER', 'ANIMAL_HERD', 'DOMESTIC_ANIMAL', 'WILD_ANIMAL', 'ROLLOVER_ON_ROADWAY', 'LEFT_TREE', 'LEFT_POLE', 'LEFT_BUILDING', 'LEFT_STREET_FURNITURE', 'LEFT_CURB', 'LEFT_DITCH', 'LEFT_OTHER', 'RIGHT_TREE', 'RIGHT_POLE', 'RIGHT_BUILDING', 'RIGHT_STREET_FURNITURE', 'RIGHT_CURB', 'RIGHT_DITCH', 'RIGHT_OTHER', 'LEFT_FALL', 'LEFT_ROLLOVER', 'LEFT_FLAT', 'LEFT_OTHER_NO_COLLISION', 'RIGHT_FALL', 'RIGHT_ROLLOVER', 'RIGHT_FLAT', 'RIGHT_OTHER_NO_COLLISION', 'PASSENGER_FALL', 'VEHICLE_FIRE', 'COLLISION_TRAIN', 'COLLISION_METRO', 'OTHER']

const steps = ['Location', 'Road & Environment', 'People & Damages']

const now = new Date()
const formatEnumLabel = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())

const initialForm = {
  accidentDate: now.toISOString().slice(0, 10),
  latitude: 34.7678,
  longitude: 9.5615,
  infoDetails: {
    accidentTime: now.toTimeString().slice(0, 8),
    governorate: '',
    delegation: '',
    municipality: '',
    sector: '',
    summary: '',
    dayTypeId: 'WORKING',
    accidentSituationId: 'ON_ROAD',
    schoolPoint: false,
    zoneId: 'ROAD',
    urbanityId: 'OUTSIDE_AGGLOMERATION',
  },
  roadConditions: {
    roadSinuosityId: 'UNIQUE',
    roadMarkingId: 'NONEXISTENT',
    planLayoutId: 'STRAIGHT',
    roadName: '',
    addressNumber: '',
    betweenStreet: '',
    andStreet: '',
    intersectionStreet: '',
    designation: '',
    roadTypeId: 'CONVENTIONAL_2X1',
    networkCategoryId: 'LOCAL',
    trafficRegimeId: 'BIDIRECTIONAL',
    trafficDirectionId: 'BOTH',
    numberOfLanes: 1,
    speedLimit: 50,
    hasTpc: false,
    roadWidthId: 'LESS_325',
    laneWidthId: 'LESS_6',
  },
  environmentConditions: {
    luminosityId: 'FULL_DAYLIGHT',
    atmosphericConditionsId: 'GOOD_WEATHER',
    visibilityId: 'CLEAR',
    roadPavementConditionId: 'PAVED',
    roadCharacteristics: '',
    roadSurfaceCondition: '',
    roadConditionText: '',
    obstacles: '',
    circumstances1: '',
    circumstances2: '',
  },
  participant: {
    id: '',
    firstName: '',
    lastName: '',
    cin: '',
    participantType: 'DRIVER',
    registrationNumber: '',
    brand: '',
    vehicleType: 'VEHICLE_ALONE',
    specialType: 'NONE',
    insurance: 'YES',
    vehiclePosition: 'FRONT_LEFT',
    pedestrianLocation: 'ROAD',
    action: 'DRIVER_STRAIGHT',
    travelReason: 'OTHER',
    plannedTrip: 'UNKNOWN',
    safetyEquipmentUse: 'SEATBELT',
    injurySeverity: 'UNINJURED',
    alcoholTest: 'NOT_DONE',
    alcoholLevel: '',
    drugTest: 'NOT_DONE',
    infraction: 'NONE',
  },
  damagesReport: {
    fatalAccident: false,
    accidentCauseId: 'INATTENTION',
    deadCount: 0,
    hospitalizedInjuredCount: 0,
    lightlyInjuredCount: 0,
    unharmedCount: 1,
    accidentTypeId: 'OTHER',
    accidentSubTypeId: 'OTHER',
    damageDescription: '',
  },
}

export default function AddIncidentDrawer({
  open,
  onClose,
  onSubmit,
  error: externalError,
  mode = 'create',
  initialData = null,
}: AddIncidentDrawerProps) {
  const theme = useTheme()
  const isSmall = useMediaQuery(theme.breakpoints.down('md'))
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(initialForm)
  const isEditMode = mode === 'edit'

  const mapAccidentToForm = (source: any) => {
    const fallback = structuredClone(initialForm)
    if (!source) return fallback

    const info = source.infoDetails || {}
    const road = source.roadConditions || {}
    const env = source.environmentConditions || {}
    const participant = Array.isArray(source.participants) && source.participants.length > 0 ? source.participants[0] : {}
    const damages = source.damagesReport || {}

    return {
      ...fallback,
      accidentDate: String(source.accidentDate || fallback.accidentDate).slice(0, 10),
      latitude: Number(source.latitude ?? fallback.latitude),
      longitude: Number(source.longitude ?? fallback.longitude),
      infoDetails: {
        ...fallback.infoDetails,
        ...info,
        accidentTime: String(info.accidentTime || fallback.infoDetails.accidentTime).slice(0, 8),
      },
      roadConditions: {
        ...fallback.roadConditions,
        ...road,
      },
      environmentConditions: {
        ...fallback.environmentConditions,
        ...env,
      },
      participant: {
        ...fallback.participant,
        ...participant,
      },
      damagesReport: {
        ...fallback.damagesReport,
        ...damages,
      },
    }
  }

  useEffect(() => {
    if (!open) {
      setForm(initialForm)
      setStep(0)
      return
    }
    if (isEditMode) {
      setForm(mapAccidentToForm(initialData))
      setStep(0)
    }
  }, [open, isEditMode, initialData])

  const setValue = (path: string, value: any) => {
    setForm((prev: any) => {
      const next = structuredClone(prev)
      const keys = path.split('.')
      let ref = next
      for (let i = 0; i < keys.length - 1; i++) ref = ref[keys[i]]
      ref[keys[keys.length - 1]] = value
      return next
    })
  }

  const canSubmit = useMemo(() => {
    return !!(
      form.accidentDate &&
      form.infoDetails.accidentTime &&
      Number.isFinite(form.latitude) &&
      Number.isFinite(form.longitude) &&
      form.infoDetails.summary.trim() &&
      form.roadConditions.roadName.trim()
    )
  }, [form])

  const selectMenuProps = useMemo(
    () => ({
      MenuProps: {
        disablePortal: false,
        sx: {
          zIndex: theme.zIndex.modal + 2,
        },
        PaperProps: {
          sx: {
            zIndex: theme.zIndex.modal + 3,
            maxHeight: 360,
            borderRadius: 2,
            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
            boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
          },
        },
      },
    }),
    [theme]
  )

  const stepIsValid = useMemo(() => {
    if (step === 0) {
      return !!(form.accidentDate && form.infoDetails.accidentTime && form.infoDetails.summary.trim())
    }
    if (step === 1) {
      return !!form.roadConditions.roadName.trim()
    }
    return true
  }, [form, step])

  const handleSubmit = async () => {
    if (!canSubmit) return
    try {
      setSubmitting(true)
      const participantId = form.participant.id || `P-${Date.now()}`
      const payload = {
        accidentDate: form.accidentDate,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        infoDetails: { ...form.infoDetails },
        roadConditions: { ...form.roadConditions },
        environmentConditions: { ...form.environmentConditions },
        participants: [
          {
            ...form.participant,
            id: participantId,
            taxId: '',
            passportNumber: '',
            eHouwiya: '',
            commercialType: '',
            usageType: '',
            vehicleNationality: '',
            registrationCardNumber: '',
            chassisNumber: '',
            insuranceContractNumber: '',
            insuranceContractDate: '',
            orangeCardNumber: '',
            insurerCompanyName: '',
            insurerAddress: '',
            insurerPhoneNumber: '',
            insurerFax: '',
            insurerEmail: '',
            insuredPersonName: '',
            insuredPersonAddress: '',
            insuredPhoneNumber: '',
            validityStartDate: '',
            validityEndDate: '',
            territorialValidity: '',
            cardDate: '',
            engineNumber: '',
            vehicleDamageMarkers: [],
            continuousDrivingHours: '',
          },
        ],
        damagesReport: {
          responsiblePartyIds: [],
          ...form.damagesReport,
          attachments: [],
        },
      }
      const result = await onSubmit?.(payload)
      const keepOpen = Boolean(result && typeof result === 'object' && (result as any).keepOpen)
      if (!keepOpen) {
        onClose()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const renderEnum = (path: string, label: string, options: string[]) => (
    <TextField
      select
      size="small"
      label={label}
      value={path.split('.').reduce((a: any, key) => a[key], form as any)}
      onChange={(e) => setValue(path, e.target.value)}
      fullWidth
      SelectProps={{
        displayEmpty: true,
        renderValue: (selected) =>
          selected ? formatEnumLabel(String(selected)) : `Select ${label}`,
      }}
      {...selectMenuProps}
    >
      <MenuItem value="" disabled sx={{ display: 'none' }}>
        Select {label}
      </MenuItem>
      {options.map((opt) => (
        <MenuItem key={opt} value={opt}>
          {formatEnumLabel(opt)}
        </MenuItem>
      ))}
    </TextField>
  )

  const sectionCardSx = {
    p: { xs: 1.75, md: 2.5 },
    borderRadius: 3.5,
    border: `1px solid ${alpha(theme.palette.divider, 0.72)}`,
    bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.9 : 0.95),
    backgroundImage:
      theme.palette.mode === 'dark'
        ? `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.background.default, 0.88)} 100%)`
        : `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.98)} 0%, ${alpha(theme.palette.background.default, 0.8)} 100%)`,
    boxShadow: `0 10px 24px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.34 : 0.08)}`,
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      fullScreen={isSmall}
      BackdropProps={{
        sx: {
          bgcolor: 'rgba(15, 23, 42, 0.62)',
          backdropFilter: 'blur(6px)',
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: isSmall ? 0 : 4,
          overflow: 'hidden',
          maxHeight: isSmall ? '100vh' : '92vh',
          background: theme.palette.background.default,
          boxShadow: '0 32px 96px rgba(0,0,0,0.40)',
          border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
        },
      }}
    >
      <DialogTitle
        sx={{
          pt: { xs: 1.75, md: 2 },
          pb: 1.5,
          px: { xs: 1.75, md: 2.5 },
          position: 'sticky',
          top: 0,
          zIndex: theme.zIndex.modal + 6,
          bgcolor: 'background.paper',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
          backgroundImage: 'none',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>
              {isEditMode ? 'Update Accident Report' : 'New Accident Report'}
            </Typography>
            {isEditMode && initialData?.id && (
              <Typography variant="caption" color="text.secondary">
                ID: {initialData.id}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" label={`Step ${step + 1} of ${steps.length}`} color="primary" variant="outlined" />
            <IconButton onClick={onClose} size="small" aria-label="Close">
              <CloseRoundedIcon />
            </IconButton>
          </Stack>
        </Stack>
      </DialogTitle>

      <DialogContent
        sx={{
          pt: 1.25,
          px: { xs: 1.25, md: 2.25 },
          pb: 2,
          background:
            theme.palette.mode === 'dark'
              ? `linear-gradient(180deg, ${alpha(theme.palette.background.default, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.96)} 100%)`
              : `linear-gradient(180deg, ${alpha(theme.palette.background.default, 0.55)} 0%, ${alpha(theme.palette.background.paper, 0.95)} 100%)`,
        }}
      >
        <Stack direction="row" justifyContent="flex-end" sx={{ mb: 0.5, display: { xs: 'none', md: 'none' } }}>
          <IconButton onClick={onClose} size="small" aria-label="Close">
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
        {externalError && (
          <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2 }}>
            {externalError}
          </Alert>
        )}

        <Paper
          sx={{
            p: { xs: 1.1, md: 1.75 },
            mb: 2.25,
            borderRadius: 3.5,
            position: 'sticky',
            top: 0,
            zIndex: theme.zIndex.modal + 5,
            bgcolor: 'background.paper',
            border: `1px solid ${alpha(theme.palette.divider, 0.72)}`,
            boxShadow: `0 8px 18px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.35 : 0.1)}`,
          }}
        >
          <Stepper activeStep={step} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>

        {step === 0 && (
          <Stack spacing={2}>
            <Paper sx={sectionCardSx}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Location & Time</Typography>
                <Chip label="Step 1" size="small" />
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <Stack spacing={1.25}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.25,
                        borderRadius: 2,
                        borderColor: alpha(theme.palette.info.main, 0.35),
                        bgcolor:
                          theme.palette.mode === 'dark'
                            ? alpha(theme.palette.info.main, 0.14)
                            : alpha(theme.palette.info.main, 0.08),
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <InfoOutlinedIcon fontSize="small" color="info" />
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          Click on the map to select accident location.
                        </Typography>
                      </Stack>
                    </Paper>
                    <AccidentLocationMap
                      initialLocation={{ latitude: form.latitude, longitude: form.longitude }}
                      onLocationChange={(loc) => {
                        setValue('latitude', loc.latitude)
                        setValue('longitude', loc.longitude)
                        if (loc.description?.trim()) {
                          setValue('roadConditions.roadName', loc.description.trim())
                        }
                      }}
                      height={340}
                      showSearch
                      readOnly={false}
                      showInstructions={false}
                    />
                  </Stack>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Stack spacing={2}>
                    <TextField size="small" type="date" label="Accident Date" value={form.accidentDate} onChange={(e) => setValue('accidentDate', e.target.value)} InputLabelProps={{ shrink: true }} />
                    <TextField size="small" type="time" label="Accident Time" value={form.infoDetails.accidentTime} onChange={(e) => setValue('infoDetails.accidentTime', e.target.value)} InputLabelProps={{ shrink: true }} />
                    <TextField size="small" type="number" label="Latitude" placeholder="e.g. 36.8065" value={form.latitude} onChange={(e) => setValue('latitude', Number(e.target.value) || 0)} />
                    <TextField size="small" type="number" label="Longitude" placeholder="e.g. 10.1815" value={form.longitude} onChange={(e) => setValue('longitude', Number(e.target.value) || 0)} />
                  </Stack>
                </Grid>
                <Grid item xs={12}>
                  <TextField size="small" label="Summary" placeholder="Short description of accident circumstances" value={form.infoDetails.summary} onChange={(e) => setValue('infoDetails.summary', e.target.value)} fullWidth required />
                </Grid>
                <Grid item xs={12} sm={6}><TextField size="small" label="Governorate" placeholder="e.g. Tunis" value={form.infoDetails.governorate} onChange={(e) => setValue('infoDetails.governorate', e.target.value)} fullWidth /></Grid>
                <Grid item xs={12} sm={6}><TextField size="small" label="Delegation" placeholder="e.g. Bab Bhar" value={form.infoDetails.delegation} onChange={(e) => setValue('infoDetails.delegation', e.target.value)} fullWidth /></Grid>
                <Grid item xs={12} sm={6}><TextField size="small" label="Municipality" placeholder="e.g. Tunis Municipality" value={form.infoDetails.municipality} onChange={(e) => setValue('infoDetails.municipality', e.target.value)} fullWidth /></Grid>
                <Grid item xs={12} sm={6}><TextField size="small" label="Sector" placeholder="e.g. Center Ville" value={form.infoDetails.sector} onChange={(e) => setValue('infoDetails.sector', e.target.value)} fullWidth /></Grid>
                <Grid item xs={12} sm={6}>{renderEnum('infoDetails.dayTypeId', 'Day Type', DAY_TYPE_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('infoDetails.accidentSituationId', 'Situation', ACCIDENT_SITUATION_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('infoDetails.zoneId', 'Zone', ZONE_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('infoDetails.urbanityId', 'Urbanity', URBANITY_OPTIONS)}</Grid>
                <Grid item xs={12}>
                  <FormControlLabel control={<Switch checked={form.infoDetails.schoolPoint} onChange={(e) => setValue('infoDetails.schoolPoint', e.target.checked)} />} label="School point" />
                </Grid>
              </Grid>
            </Paper>
          </Stack>
        )}

        {step === 1 && (
          <Stack spacing={2}>
            <Paper sx={sectionCardSx}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Road Conditions</Typography>
                <Chip label="Step 2" size="small" color="warning" />
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={12}><TextField size="small" label="Road Name" placeholder="e.g. Avenue Habib Bourguiba" value={form.roadConditions.roadName} onChange={(e) => setValue('roadConditions.roadName', e.target.value)} fullWidth required /></Grid>
                <Grid item xs={12} sm={6}>{renderEnum('roadConditions.roadSinuosityId', 'Sinuosity', ROAD_SINUOSITY_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('roadConditions.roadMarkingId', 'Marking', ROAD_MARKING_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('roadConditions.planLayoutId', 'Plan Layout', PLAN_LAYOUT_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('roadConditions.roadTypeId', 'Road Type', ROAD_TYPE_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('roadConditions.networkCategoryId', 'Network Category', NETWORK_CATEGORY_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('roadConditions.trafficRegimeId', 'Traffic Regime', TRAFFIC_REGIME_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('roadConditions.trafficDirectionId', 'Traffic Direction', TRAFFIC_DIRECTION_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('roadConditions.roadWidthId', 'Road Width', ROAD_WIDTH_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('roadConditions.laneWidthId', 'Lane Width', LANE_WIDTH_OPTIONS)}</Grid>
              </Grid>
            </Paper>

            <Paper sx={sectionCardSx}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Environment</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>{renderEnum('environmentConditions.luminosityId', 'Luminosity', LUMINOSITY_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('environmentConditions.atmosphericConditionsId', 'Atmospheric', ATMOSPHERIC_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('environmentConditions.visibilityId', 'Visibility', VISIBILITY_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('environmentConditions.roadPavementConditionId', 'Pavement', ROAD_PAVEMENT_OPTIONS)}</Grid>
              </Grid>
            </Paper>
          </Stack>
        )}

        {step === 2 && (
          <Stack spacing={2}>
            <Paper sx={sectionCardSx}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Participant</Typography>
                <Chip label="Step 3" size="small" color="success" />
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}><TextField size="small" label="First Name" placeholder="Participant first name" value={form.participant.firstName} onChange={(e) => setValue('participant.firstName', e.target.value)} fullWidth /></Grid>
                <Grid item xs={12} sm={6}><TextField size="small" label="Last Name" placeholder="Participant last name" value={form.participant.lastName} onChange={(e) => setValue('participant.lastName', e.target.value)} fullWidth /></Grid>
                <Grid item xs={12} sm={6}><TextField size="small" label="CIN" placeholder="National ID number" value={form.participant.cin} onChange={(e) => setValue('participant.cin', e.target.value)} fullWidth /></Grid>
                <Grid item xs={12} sm={6}><TextField size="small" label="Registration Number" placeholder="Vehicle plate number" value={form.participant.registrationNumber} onChange={(e) => setValue('participant.registrationNumber', e.target.value)} fullWidth /></Grid>
                <Grid item xs={12} sm={6}>{renderEnum('participant.participantType', 'Participant Type', PARTICIPANT_TYPE_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('participant.vehicleType', 'Vehicle Type', VEHICLE_TYPE_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('participant.specialType', 'Special Type', SPECIAL_TYPE_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('participant.insurance', 'Insurance', INSURANCE_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('participant.vehiclePosition', 'Vehicle Position', VEHICLE_POSITION_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('participant.pedestrianLocation', 'Pedestrian Location', PEDESTRIAN_LOCATION_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('participant.action', 'Action', ACTION_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('participant.travelReason', 'Travel Reason', TRAVEL_REASON_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('participant.plannedTrip', 'Planned Trip', PLANNED_TRIP_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('participant.safetyEquipmentUse', 'Safety Equipment', SAFETY_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('participant.injurySeverity', 'Injury Severity', INJURY_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('participant.alcoholTest', 'Alcohol Test', ALCOHOL_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('participant.drugTest', 'Drug Test', DRUG_OPTIONS)}</Grid>
                <Grid item xs={12}>{renderEnum('participant.infraction', 'Infraction', INFRACTION_OPTIONS)}</Grid>
              </Grid>
            </Paper>

            <Paper sx={sectionCardSx}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Damages Report</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>{renderEnum('damagesReport.accidentCauseId', 'Accident Cause', ACCIDENT_CAUSE_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('damagesReport.accidentTypeId', 'Accident Type', ACCIDENT_TYPE_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>{renderEnum('damagesReport.accidentSubTypeId', 'Accident Subtype', ACCIDENT_SUBTYPE_OPTIONS)}</Grid>
                <Grid item xs={12} sm={6}>
                  <FormControlLabel control={<Switch checked={form.damagesReport.fatalAccident} onChange={(e) => setValue('damagesReport.fatalAccident', e.target.checked)} />} label="Fatal Accident" />
                </Grid>
                <Grid item xs={12} sm={3}><TextField size="small" type="number" label="Dead" value={form.damagesReport.deadCount} onChange={(e) => setValue('damagesReport.deadCount', Number(e.target.value) || 0)} fullWidth /></Grid>
                <Grid item xs={12} sm={3}><TextField size="small" type="number" label="Hospitalized" value={form.damagesReport.hospitalizedInjuredCount} onChange={(e) => setValue('damagesReport.hospitalizedInjuredCount', Number(e.target.value) || 0)} fullWidth /></Grid>
                <Grid item xs={12} sm={3}><TextField size="small" type="number" label="Light Injured" value={form.damagesReport.lightlyInjuredCount} onChange={(e) => setValue('damagesReport.lightlyInjuredCount', Number(e.target.value) || 0)} fullWidth /></Grid>
                <Grid item xs={12} sm={3}><TextField size="small" type="number" label="Unharmed" value={form.damagesReport.unharmedCount} onChange={(e) => setValue('damagesReport.unharmedCount', Number(e.target.value) || 0)} fullWidth /></Grid>
                <Grid item xs={12}><TextField size="small" label="Damage Description" placeholder="Describe visible damage and impact details" value={form.damagesReport.damageDescription} onChange={(e) => setValue('damagesReport.damageDescription', e.target.value)} fullWidth multiline minRows={2} /></Grid>
              </Grid>
            </Paper>
          </Stack>
        )}

        <Box sx={{ mt: 2.5 }}>
          <IncidentDocumentsPanel accidentId={String(initialData?.id || '') || null} />
        </Box>
      </DialogContent>

      <Box
        sx={{
          px: { xs: 1.5, md: 2.25 },
          py: { xs: 1.75, md: 2 },
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
          bgcolor: 'background.paper',
          position: 'sticky',
          bottom: 0,
          zIndex: theme.zIndex.modal + 6,
          backdropFilter: 'blur(8px)',
          boxShadow: `0 -8px 24px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.32 : 0.08)}`,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Button
            startIcon={<ArrowBackRoundedIcon />}
            onClick={() => setStep((prev) => Math.max(0, prev - 1))}
            disabled={step === 0}
          >
            Back
          </Button>

          <Stack direction="row" spacing={1.5}>
            <Button onClick={onClose}>Cancel</Button>
            {step < steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={() => setStep((prev) => prev + 1)}
                disabled={!stepIsValid}
                endIcon={<ArrowForwardRoundedIcon />}
              >
                Continue
              </Button>
            ) : (
              <Button
                variant="contained"
                color="success"
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                startIcon={<CheckCircleRoundedIcon />}
              >
                {submitting ? 'Submitting...' : isEditMode ? 'Update Accident' : 'Submit Accident'}
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>
    </Dialog>
  )
}
