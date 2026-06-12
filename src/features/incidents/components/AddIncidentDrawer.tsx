import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import {
  Alert,
  alpha,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  GridLegacy as Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
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
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded'
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded'
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded'
import { AnimatePresence, motion, animate, type Variants } from 'framer-motion'
import AccidentLocationMap from '@/components/Common/AccidentLocationMap'
import IncidentDocumentsPanel from './IncidentDocumentsPanel'
import { moveStoredDocuments } from '../hooks/useIncidentDocuments'
import { useTranslation, useThemeMode } from '../../../themeMode'
import { getEnumLabel } from './incidentEnumLabels'
import { useAppSelector } from '../../../store/store'
import type { Incident } from '../slices/incidentsSlice'

const PERIMETER_RADIUS_M = 200

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

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
const GENDER_OPTIONS = ['MALE', 'FEMALE', 'UNKNOWN']
const LICENSE_STATUS_OPTIONS = ['VALID', 'EXPIRED', 'SUSPENDED', 'DRIVING_SCHOOL', 'INVALID_CATEGORY', 'NO_LICENSE', 'ACCOMPANIED_DRIVING']
const SPEED_INFRACTION_OPTIONS = ['INAPPROPRIATE_SPEED', 'EXCEEDING_LIMIT', 'SLOW_OBSTRUCTING', 'NONE', 'UNKNOWN']
const ADMIN_INFRACTION_OPTIONS = ['NO_ADEQUATE_LICENSE', 'EXPIRED_LICENSE', 'EXCESS_LOAD', 'NO_TECHNICAL_INSPECTION', 'TACHOGRAPH_NOT_CHECKED', 'NONE', 'UNKNOWN']
const OTHER_INFRACTION_OPTIONS = ['DISTRACTED_DRIVING', 'IMPROPER_LIGHTING', 'WRONG_WAY', 'PARTIAL_WRONG_WAY', 'IMPROPER_TURN', 'ILLEGAL_OVERTAKING', 'ZIGZAG_DRIVING', 'INSUFFICIENT_DISTANCE', 'UNJUSTIFIED_BRAKING', 'FAILURE_TO_YIELD', 'DISREGARD_TRAFFIC_LIGHTS', 'DISREGARD_STOP_SIGN', 'DISREGARD_YIELD_SIGN', 'DISREGARD_PEDESTRIAN_CROSSING', 'DISREGARD_OTHER_SIGNAL', 'IMPROPER_SIGNALING', 'UNSAFE_ENTRY', 'DANGEROUS_PARKING', 'UNSAFE_DOOR_OPENING', 'OTHER', 'NONE']
const PEDESTRIAN_INFRACTION_OPTIONS = ['DISREGARD_PEDESTRIAN_SIGNAL', 'NOT_USING_CROSSWALK', 'DISREGARD_AGENT_SIGNAL', 'ILLEGAL_CROSSING', 'IMPROPER_ON_ROADWAY', 'IMPROPER_ON_SHOULDER', 'IMPROPER_BOARDING', 'OTHER', 'NONE']
const CONTINUOUS_DRIVING_OPTIONS = ['UNDER_20MIN', 'FROM_20MIN_TO_1H', 'FROM_1H_TO_3H', 'FROM_3H_TO_5H', 'OVER_5H', 'UNKNOWN']
const REFERENCE_OPTIONS = ['NATIONAL_GUARD', 'POLICE']
const ACCIDENT_TYPE_OPTIONS = ['COLLISION_MOVING', 'COLLISION_OBSTACLE', 'COLLISION_PEDESTRIAN_ANIMAL', 'ROLLOVER_ON_ROADWAY', 'RUNOFF_LEFT_COLLISION', 'RUNOFF_RIGHT_COLLISION', 'RUNOFF_LEFT_NO_COLLISION', 'RUNOFF_RIGHT_NO_COLLISION', 'OTHER']
const ACCIDENT_SUBTYPE_OPTIONS = ['FRONT', 'REAR', 'SIDE', 'FRONT_SIDE', 'CHAIN', 'MULTIPLE', 'PARKED_VEHICLE', 'SAFETY_BARRIER', 'LEVEL_CROSSING_BARRIER', 'SIGNAL_SUPPORT', 'ISLAND_REFUGE', 'OTHER_OBJECT', 'PEDESTRIAN_GROUP', 'PEDESTRIAN_BICYCLE', 'PEDESTRIAN_REPAIR', 'ANIMAL_DRIVER', 'ANIMAL_HERD', 'DOMESTIC_ANIMAL', 'WILD_ANIMAL', 'ROLLOVER_ON_ROADWAY', 'LEFT_TREE', 'LEFT_POLE', 'LEFT_BUILDING', 'LEFT_STREET_FURNITURE', 'LEFT_CURB', 'LEFT_DITCH', 'LEFT_OTHER', 'RIGHT_TREE', 'RIGHT_POLE', 'RIGHT_BUILDING', 'RIGHT_STREET_FURNITURE', 'RIGHT_CURB', 'RIGHT_DITCH', 'RIGHT_OTHER', 'LEFT_FALL', 'LEFT_ROLLOVER', 'LEFT_FLAT', 'LEFT_OTHER_NO_COLLISION', 'RIGHT_FALL', 'RIGHT_ROLLOVER', 'RIGHT_FLAT', 'RIGHT_OTHER_NO_COLLISION', 'PASSENGER_FALL', 'VEHICLE_FIRE', 'COLLISION_TRAIN', 'COLLISION_METRO', 'OTHER']

const formatEnumLabel = (value: string) =>
  value.replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

const ensureEnumStr = (val: any, options: string[], fallback: string): string => {
  if (typeof val === 'string' && options.includes(val)) return val
  if (val == null) return fallback
  if (typeof val === 'object') {
    const name = val.name ?? val.label ?? val.value
    if (typeof name === 'string' && options.includes(name)) return name
  }
  return fallback
}

function makeInitialForm() {
  const now = new Date()
  return {
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
    reference: 'POLICE' as string,
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
    locality: '',
    roadNature: '',
    pk: '',
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
    gender: '' as string,
    age: '' as string,
    driverNationality: '',
    licenseStatus: '' as string,
    licenseIssueDate: '',
    speedInfraction: 'NONE',
    adminInfraction: 'NONE',
    otherInfraction: 'NONE',
    pedestrianInfraction: 'NONE',
    continuousDrivingHoursId: 'UNKNOWN',
  },
  damagesReport: {
    fatalAccident: false,
    accidentCauseId: 'INATTENTION',
    accidentCauseId2: '' as string,
    deadCount: 0,
    hospitalizedInjuredCount: 0,
    lightlyInjuredCount: 0,
    unharmedCount: 1,
    accidentTypeId: 'OTHER',
    accidentSubTypeId: 'OTHER',
    damageDescription: '',
  },
  }
}

// Direction-aware step slide animation
const easeOut = [0.0, 0.0, 0.2, 1.0] as [number, number, number, number]
const easeIn = [0.4, 0.0, 1.0, 1.0] as [number, number, number, number]

const stepVariants = {
  enter: (d: number) => ({ x: d > 0 ? 40 : -40, opacity: 0, scale: 0.99 }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: 0.28, ease: easeOut },
  },
  exit: (d: number) => ({
    x: d < 0 ? 40 : -40,
    opacity: 0,
    scale: 0.99,
    transition: { duration: 0.16, ease: easeIn },
  }),
}

const iconSwap: Variants = {
  initial: { opacity: 0, scale: 0.5, rotate: -15 },
  animate: { opacity: 1, scale: 1, rotate: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 30 } },
  exit: { opacity: 0, scale: 0.5, rotate: 15, transition: { duration: 0.1 } },
}

const _easeDecel = [0.0, 0.0, 0.2, 1.0] as [number, number, number, number]

const fieldParent: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.06 } },
}
const fieldChild: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: _easeDecel } },
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
  const { t } = useTranslation()
  const { locale } = useThemeMode()
  const enumLabel = (value: string) => getEnumLabel(value, locale, formatEnumLabel)
  const isSmall = useMediaQuery(theme.breakpoints.down('md'))
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(0)
  const [stepDirection, setStepDirection] = useState(1)
  const [form, setForm] = useState(() => makeInitialForm())
  const isEditMode = mode === 'edit'
  const existingIncidents = useAppSelector((state) => state.incidents.list)
  const [perimeterWarning, setPerimeterWarning] = useState<{ location: string; distanceM: number } | null>(null)
  const [draftDocumentKey, setDraftDocumentKey] = useState(`incident-draft-${crypto.randomUUID()}`)
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const cleanFormRef = useRef<ReturnType<typeof makeInitialForm> | null>(null)
  const continueButtonRef = useRef<HTMLSpanElement>(null)

  const isDirty = useMemo(
    () => cleanFormRef.current !== null && JSON.stringify(form) !== JSON.stringify(cleanFormRef.current),
    [form]
  )

  const handleClose = () => {
    if (isDirty && !submitting) {
      setConfirmDiscardOpen(true)
    } else {
      onClose()
    }
  }
  const handleDiscardConfirm = () => {
    setConfirmDiscardOpen(false)
    onClose()
  }

  const steps = [
    { label: t('add_incident.step_location'), icon: <PlaceRoundedIcon sx={{ fontSize: 16 }} /> },
    { label: t('add_incident.step_road'), icon: <DirectionsCarRoundedIcon sx={{ fontSize: 16 }} /> },
    { label: t('add_incident.step_people'), icon: <PeopleRoundedIcon sx={{ fontSize: 16 }} /> },
  ]

  const mapAccidentToForm = (source: any) => {
    const fallback = makeInitialForm()
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
        dayTypeId: ensureEnumStr(info.dayTypeId, DAY_TYPE_OPTIONS, 'WORKING'),
        accidentSituationId: ensureEnumStr(info.accidentSituationId, ACCIDENT_SITUATION_OPTIONS, 'ON_ROAD'),
        zoneId: ensureEnumStr(info.zoneId, ZONE_OPTIONS, 'ROAD'),
        urbanityId: ensureEnumStr(info.urbanityId, URBANITY_OPTIONS, 'OUTSIDE_AGGLOMERATION'),
        reference: ensureEnumStr(info.reference, REFERENCE_OPTIONS, 'POLICE'),
      },
      roadConditions: {
        ...fallback.roadConditions,
        ...road,
        roadSinuosityId: ensureEnumStr(road.roadSinuosityId, ROAD_SINUOSITY_OPTIONS, 'UNIQUE'),
        roadMarkingId: ensureEnumStr(road.roadMarkingId, ROAD_MARKING_OPTIONS, 'NONEXISTENT'),
        planLayoutId: ensureEnumStr(road.planLayoutId, PLAN_LAYOUT_OPTIONS, 'STRAIGHT'),
        roadTypeId: ensureEnumStr(road.roadTypeId, ROAD_TYPE_OPTIONS, 'CONVENTIONAL_2X1'),
        networkCategoryId: ensureEnumStr(road.networkCategoryId, NETWORK_CATEGORY_OPTIONS, 'LOCAL'),
        trafficRegimeId: ensureEnumStr(road.trafficRegimeId, TRAFFIC_REGIME_OPTIONS, 'BIDIRECTIONAL'),
        trafficDirectionId: ensureEnumStr(road.trafficDirectionId, TRAFFIC_DIRECTION_OPTIONS, 'BOTH'),
        roadWidthId: ensureEnumStr(road.roadWidthId, ROAD_WIDTH_OPTIONS, 'LESS_325'),
        laneWidthId: ensureEnumStr(road.laneWidthId, LANE_WIDTH_OPTIONS, 'LESS_6'),
        locality: String(road.locality ?? ''),
        roadNature: String(road.roadNature ?? ''),
        pk: String(road.pk ?? ''),
      },
      environmentConditions: {
        ...fallback.environmentConditions,
        ...env,
        luminosityId: ensureEnumStr(env.luminosityId, LUMINOSITY_OPTIONS, 'FULL_DAYLIGHT'),
        atmosphericConditionsId: ensureEnumStr(env.atmosphericConditionsId, ATMOSPHERIC_OPTIONS, 'GOOD_WEATHER'),
        visibilityId: ensureEnumStr(env.visibilityId, VISIBILITY_OPTIONS, 'CLEAR'),
        roadPavementConditionId: ensureEnumStr(env.roadPavementConditionId, ROAD_PAVEMENT_OPTIONS, 'PAVED'),
      },
      participant: {
        ...fallback.participant,
        ...participant,
        participantType: ensureEnumStr(participant.participantType, PARTICIPANT_TYPE_OPTIONS, 'DRIVER'),
        vehicleType: ensureEnumStr(participant.vehicleType, VEHICLE_TYPE_OPTIONS, 'VEHICLE_ALONE'),
        specialType: ensureEnumStr(participant.specialType, SPECIAL_TYPE_OPTIONS, 'NONE'),
        insurance: ensureEnumStr(participant.insurance, INSURANCE_OPTIONS, 'YES'),
        vehiclePosition: ensureEnumStr(participant.vehiclePosition, VEHICLE_POSITION_OPTIONS, 'FRONT_LEFT'),
        pedestrianLocation: ensureEnumStr(participant.pedestrianLocation, PEDESTRIAN_LOCATION_OPTIONS, 'ROAD'),
        action: ensureEnumStr(participant.action, ACTION_OPTIONS, 'DRIVER_STRAIGHT'),
        travelReason: ensureEnumStr(participant.travelReason, TRAVEL_REASON_OPTIONS, 'OTHER'),
        plannedTrip: ensureEnumStr(participant.plannedTrip, PLANNED_TRIP_OPTIONS, 'UNKNOWN'),
        safetyEquipmentUse: ensureEnumStr(participant.safetyEquipmentUse, SAFETY_OPTIONS, 'SEATBELT'),
        injurySeverity: ensureEnumStr(participant.injurySeverity, INJURY_OPTIONS, 'UNINJURED'),
        alcoholTest: ensureEnumStr(participant.alcoholTest, ALCOHOL_OPTIONS, 'NOT_DONE'),
        drugTest: ensureEnumStr(participant.drugTest, DRUG_OPTIONS, 'NOT_DONE'),
        infraction: ensureEnumStr(participant.infraction, INFRACTION_OPTIONS, 'NONE'),
        gender: ensureEnumStr(participant.gender, GENDER_OPTIONS, ''),
        age: participant.age != null ? String(participant.age) : '',
        driverNationality: String(participant.driverNationality ?? ''),
        licenseStatus: ensureEnumStr(participant.licenseStatus, LICENSE_STATUS_OPTIONS, ''),
        licenseIssueDate: String(participant.licenseIssueDate ?? ''),
        speedInfraction: ensureEnumStr(participant.speedInfraction, SPEED_INFRACTION_OPTIONS, 'NONE'),
        adminInfraction: ensureEnumStr(participant.adminInfraction, ADMIN_INFRACTION_OPTIONS, 'NONE'),
        otherInfraction: ensureEnumStr(participant.otherInfraction, OTHER_INFRACTION_OPTIONS, 'NONE'),
        pedestrianInfraction: ensureEnumStr(participant.pedestrianInfraction, PEDESTRIAN_INFRACTION_OPTIONS, 'NONE'),
        continuousDrivingHoursId: ensureEnumStr(participant.continuousDrivingHoursId, CONTINUOUS_DRIVING_OPTIONS, 'UNKNOWN'),
      },
      damagesReport: {
        ...fallback.damagesReport,
        ...damages,
        accidentCauseId: ensureEnumStr(damages.accidentCauseId, ACCIDENT_CAUSE_OPTIONS, 'INATTENTION'),
        accidentCauseId2: ensureEnumStr(damages.accidentCauseId2, ACCIDENT_CAUSE_OPTIONS, ''),
        accidentTypeId: ensureEnumStr(damages.accidentTypeId, ACCIDENT_TYPE_OPTIONS, 'OTHER'),
        accidentSubTypeId: ensureEnumStr(damages.accidentSubTypeId, ACCIDENT_SUBTYPE_OPTIONS, 'OTHER'),
      },
    }
  }

  useEffect(() => {
    if (!open) {
      setForm(makeInitialForm())
      setStep(0)
      setStepDirection(1)
      setShowErrors(false)
      setPerimeterWarning(null)
      cleanFormRef.current = null
      return
    }
    if (!isEditMode) {
      setDraftDocumentKey(`incident-draft-${crypto.randomUUID()}`)
      const fresh = makeInitialForm()
      setForm(fresh)
      cleanFormRef.current = structuredClone(fresh)
    }
    if (isEditMode) {
      const mapped = mapAccidentToForm(initialData)
      setForm(mapped)
      cleanFormRef.current = structuredClone(mapped)
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

  const canSubmit = useMemo(() => !!(
    form.accidentDate &&
    form.infoDetails.accidentTime &&
    Number.isFinite(form.latitude) &&
    Number.isFinite(form.longitude) &&
    form.infoDetails.summary.trim() &&
    form.roadConditions.roadName.trim()
  ), [form])

  const stepIsValid = useMemo(() => {
    if (step === 0) return !!(form.accidentDate && form.infoDetails.accidentTime && form.infoDetails.summary.trim())
    if (step === 1) return !!form.roadConditions.roadName.trim()
    return true
  }, [form, step])

  // Auto-reset validation errors once the user fixes the blocking field
  useEffect(() => {
    if (showErrors && stepIsValid) setShowErrors(false)
  }, [form, stepIsValid, showErrors])

  // Reset errors on step change
  useEffect(() => { setShowErrors(false) }, [step])

  const findNearbyIncident = useCallback((lat: number, lng: number) => {
    const editingId = isEditMode ? String(initialData?.id || '') : null
    let closestMatch: { incident: Incident; distanceM: number } | null = null
    for (const incident of existingIncidents) {
      if (editingId && incident.id === editingId) continue
      if (!Number.isFinite(incident.latitude) || !Number.isFinite(incident.longitude)) continue
      const d = haversineDistance(lat, lng, incident.latitude!, incident.longitude!)
      if (d < PERIMETER_RADIUS_M) {
        if (!closestMatch || d < closestMatch.distanceM) closestMatch = { incident, distanceM: d }
      }
    }
    return closestMatch
  }, [existingIncidents, isEditMode, initialData])

  const checkPerimeter = useCallback((lat: number, lng: number) => {
    const result = findNearbyIncident(lat, lng)
    if (result) {
      setPerimeterWarning({ location: result.incident.location, distanceM: result.distanceM })
    } else {
      setPerimeterWarning(null)
    }
  }, [findNearbyIncident])

  // Re-run perimeter check whenever coordinates change (catches initial default location)
  useEffect(() => {
    if (open && !isEditMode) {
      checkPerimeter(form.latitude, form.longitude)
    }
  }, [form.latitude, form.longitude, open, isEditMode, checkPerimeter])

  const documentScopeKey = isEditMode ? String(initialData?.id || '') : draftDocumentKey
  const documentsEnabled = isEditMode ? Boolean(initialData?.id) : canSubmit

  const selectMenuProps = useMemo(() => ({
    MenuProps: {
      disablePortal: false,
      sx: { zIndex: theme.zIndex.modal + 2 },
      PaperProps: {
        sx: {
          zIndex: theme.zIndex.modal + 3,
          maxHeight: 320,
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
        },
      },
    },
  }), [theme])

  const goNext = () => {
    if (!stepIsValid) {
      setShowErrors(true)
      if (continueButtonRef.current) {
        animate(continueButtonRef.current, { x: [0, -8, 8, -5, 5, 0] }, { duration: 0.38, ease: 'easeInOut' })
      }
      return
    }
    setStepDirection(1)
    setStep((p) => Math.min(steps.length - 1, p + 1))
  }
  const goBack = () => {
    setStepDirection(-1)
    setStep((p) => Math.max(0, p - 1))
  }
  const jumpTo = (i: number) => {
    if (i === step) return
    setStepDirection(i > step ? 1 : -1)
    setStep(i)
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    if (!isEditMode) {
      const result = findNearbyIncident(form.latitude, form.longitude)
      if (result) {
        setPerimeterWarning({ location: result.incident.location, distanceM: result.distanceM })
        return
      }
    }
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
        participants: [{
          ...form.participant,
          id: participantId,
          age: form.participant.age !== '' ? Number(form.participant.age) : null,
          gender: form.participant.gender || null,
          licenseStatus: form.participant.licenseStatus || null,
          licenseIssueDate: form.participant.licenseIssueDate || null,
          taxId: '', passportNumber: '', eHouwiya: '', commercialType: '', usageType: '',
          vehicleNationality: '', registrationCardNumber: '', chassisNumber: '',
          insuranceContractNumber: '', insuranceContractDate: '', orangeCardNumber: '',
          insurerCompanyName: '', insurerAddress: '', insurerPhoneNumber: '', insurerFax: '',
          insurerEmail: '', insuredPersonName: '', insuredPersonAddress: '', insuredPhoneNumber: '',
          validityStartDate: '', validityEndDate: '', territorialValidity: '', cardDate: '',
          engineNumber: '', vehicleDamageMarkers: [], continuousDrivingHours: '',
        }],
        damagesReport: { responsiblePartyIds: [], ...form.damagesReport, attachments: [] },
      }
      const result = await onSubmit?.(payload)
      const keepOpen = Boolean(result && typeof result === 'object' && (result as any).keepOpen)
      const createdIncidentId = String((result as any)?.incident?.id || (result as any)?.id || '')
      if (!isEditMode && createdIncidentId) {
        moveStoredDocuments(documentScopeKey, createdIncidentId)
      }
      if (!keepOpen) onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const renderEnum = (path: string, label: string, options: string[], required = false) => (
    <TextField
      select
      size="small"
      label={label}
      required={required}
      value={path.split('.').reduce((a: any, key) => a[key], form as any)}
      onChange={(e) => setValue(path, e.target.value)}
      fullWidth
      SelectProps={{
        displayEmpty: true,
        renderValue: (selected) =>
          selected ? enumLabel(String(selected)) : `${t('add_incident.select_prefix')} ${label}`,
      }}
      {...selectMenuProps}
    >
      <MenuItem value="" disabled sx={{ display: 'none' }}>
        {t('add_incident.select_prefix')} {label}
      </MenuItem>
      {options.map((opt) => (
        <MenuItem key={opt} value={opt}>{enumLabel(opt)}</MenuItem>
      ))}
    </TextField>
  )

  // â”€â”€â”€ Section header component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const SectionHeader = ({ label, color = 'primary' }: { label: string; color?: string }) => (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.75 }}>
      <Box sx={{ width: 3, height: 20, borderRadius: 2, bgcolor: `${color}.main`, flexShrink: 0 }} />
      <Typography
        variant="overline"
        sx={{ fontWeight: 800, letterSpacing: 1.4, fontSize: '0.68rem', color: 'text.secondary', lineHeight: 1 }}
      >
        {label}
      </Typography>
    </Stack>
  )

  const progressValue = ((step + 1) / steps.length) * 100

  return (
    <>
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xl"
      fullWidth
      fullScreen={isSmall}
      BackdropProps={{
        sx: { bgcolor: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(6px)' },
      }}
      PaperProps={{
        sx: {
          borderRadius: isSmall ? 0 : 4,
          overflow: 'hidden',
          maxHeight: isSmall ? '100vh' : '90vh',
          background: theme.palette.background.default,
          boxShadow: '0 32px 80px rgba(0,0,0,0.36)',
          border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
        },
      }}
    >
      {/* â”€â”€ Sticky header: title + step tracker + progress â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <DialogTitle
        sx={{
          pt: 2.5,
          pb: 0,
          px: { xs: 2, md: 3 },
          position: 'sticky',
          top: 0,
          zIndex: theme.zIndex.modal + 6,
          bgcolor: 'background.paper',
          backgroundImage: 'none',
        }}
      >
        {/* Title row */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.2 }}>
              {isEditMode ? t('add_incident.title_update') : t('add_incident.title_new')}
            </Typography>
            {isEditMode && initialData?.id && (
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                #{initialData.id}
              </Typography>
            )}
          </Box>
          <IconButton
            onClick={handleClose}
            size="small"
            sx={{
              mt: -0.5,
              color: 'text.secondary',
              '&:hover': { bgcolor: alpha(theme.palette.action.active, 0.06) },
            }}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>

        <>
            {/* Step indicator pills â€” clickable for completed steps */}
            <Stack direction="row" spacing={0} alignItems="center" sx={{ mb: 2 }}>
              {steps.map((s, i) => {
                const isActive = i === step
                const isDone = i < step
                const isClickable = isDone
                return (
                  <Stack key={s.label} direction="row" alignItems="center" sx={{ flex: i < steps.length - 1 ? 1 : 'none' }}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      onClick={() => isClickable && jumpTo(i)}
                      sx={{
                        px: 1.5,
                        py: 0.75,
                        borderRadius: '100px',
                        cursor: isClickable ? 'pointer' : 'default',
                        bgcolor: isActive
                          ? alpha(theme.palette.primary.main, 0.1)
                          : isDone
                            ? alpha(theme.palette.success.main, 0.08)
                            : 'transparent',
                        border: `1.5px solid`,
                        borderColor: isActive
                          ? alpha(theme.palette.primary.main, 0.4)
                          : isDone
                            ? alpha(theme.palette.success.main, 0.35)
                            : alpha(theme.palette.divider, 0.6),
                        transition: 'all 0.2s ease',
                        '&:hover': isClickable ? { bgcolor: alpha(theme.palette.success.main, 0.12) } : {},
                      }}
                    >
                      <motion.div
                        animate={{
                          backgroundColor: isActive
                            ? theme.palette.primary.main
                            : isDone
                              ? theme.palette.success.main
                              : alpha(theme.palette.action.active, 0.12),
                          scale: isActive ? 1.08 : 1,
                        }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          color: isActive || isDone ? 'white' : theme.palette.text.disabled,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          overflow: 'hidden',
                        }}
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          {isDone ? (
                            <motion.span key="check" variants={iconSwap} initial="initial" animate="animate" exit="exit" style={{ display: 'flex' }}>
                              <CheckCircleRoundedIcon sx={{ fontSize: 14 }} />
                            </motion.span>
                          ) : (
                            <motion.span key={`num-${i}`} variants={iconSwap} initial="initial" animate="animate" exit="exit">
                              <Typography sx={{ fontSize: 11, fontWeight: 800, lineHeight: 1 }}>{i + 1}</Typography>
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.div>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? 'primary.main' : isDone ? 'success.main' : 'text.secondary',
                          whiteSpace: 'nowrap',
                          display: { xs: 'none', sm: 'block' },
                        }}
                      >
                        {s.label}
                      </Typography>
                    </Stack>

                    {/* Connector line between steps */}
                    {i < steps.length - 1 && (
                      <Box sx={{ flex: 1, height: 2, mx: 1, borderRadius: 1, bgcolor: alpha(theme.palette.divider, 0.4), position: 'relative', overflow: 'hidden' }}>
                        <motion.div
                          animate={{ scaleX: isDone ? 1 : 0 }}
                          initial={{ scaleX: 0 }}
                          transition={{ duration: 0.35, ease: easeOut }}
                          style={{
                            position: 'absolute', inset: 0, borderRadius: 4,
                            backgroundColor: alpha(theme.palette.success.main, 0.5),
                            transformOrigin: 'left center',
                          }}
                        />
                      </Box>
                    )}
                  </Stack>
                )
              })}
            </Stack>

            {/* Thin progress bar */}
            <LinearProgress
              variant="determinate"
              value={progressValue}
              sx={{
                height: 3,
                borderRadius: 0,
                mx: { xs: -2, md: -3 },
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                '& .MuiLinearProgress-bar': {
                  borderRadius: 0,
                  transition: 'transform 0.45s cubic-bezier(0.0, 0.0, 0.2, 1)',
                },
              }}
            />
          </>
      </DialogTitle>

      {/* â”€â”€ Scrollable content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <DialogContent sx={{ pt: 2.5, px: { xs: 2, md: 3 }, pb: 2, overflowX: 'hidden' }}>
        {externalError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{externalError}</Alert>
        )}

        <>
          <AnimatePresence custom={stepDirection} mode="wait">
          <motion.div
            key={step}
            custom={stepDirection}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            style={{ willChange: 'transform, opacity' }}
          >
            {/* â”€â”€ Step 0: Location & Time â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {step === 0 && (
              <Grid container spacing={3}>
                {/* Map â€” dominant, left side */}
                <Grid item xs={12} md={7} lg={8}>
                  <Box
                    sx={{
                      borderRadius: 3,
                      overflow: 'hidden',
                      border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                      position: 'relative',
                    }}
                  >
                    <AccidentLocationMap
                      initialLocation={{ latitude: form.latitude, longitude: form.longitude }}
                      onLocationChange={(loc) => {
                        setValue('latitude', loc.latitude)
                        setValue('longitude', loc.longitude)
                        if (!isEditMode) checkPerimeter(loc.latitude, loc.longitude)
                        if (loc.description?.trim()) {
                          setValue('roadConditions.roadName', loc.description.trim())
                        }
                        if (loc.adminContext) {
                          const { governorate, delegation, municipality, sector } = loc.adminContext
                          if (governorate) setValue('infoDetails.governorate', governorate)
                          if (delegation) setValue('infoDetails.delegation', delegation)
                          if (municipality) setValue('infoDetails.municipality', municipality)
                          if (sector) setValue('infoDetails.sector', sector)
                        }
                      }}
                      height={isSmall ? 300 : 460}
                      showSearch
                      showInstructions={false}
                    />
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 1, ml: 0.5, fontStyle: 'italic' }}
                  >
                    {t('add_incident.map_hint')}
                  </Typography>

                  {/* Perimeter conflict card */}
                  <AnimatePresence>
                    {perimeterWarning && !isEditMode && (
                      <motion.div
                        key="perimeter-warning"
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: [0, 0, 0.2, 1] } }}
                        exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.14 } }}
                      >
                        <Box
                          sx={{
                            mt: 1.5,
                            p: 0,
                            borderRadius: 3,
                            overflow: 'hidden',
                            border: `1.5px solid ${alpha(theme.palette.warning.main, 0.4)}`,
                            bgcolor: alpha(theme.palette.warning.main, 0.05),
                          }}
                        >
                          {/* Accent stripe */}
                          <Box sx={{ height: 3, bgcolor: 'warning.main' }} />

                          <Stack direction="row" spacing={1.5} sx={{ px: 2, py: 1.5, alignItems: 'flex-start' }}>
                            {/* Icon badge */}
                            <Box
                              sx={{
                                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                bgcolor: alpha(theme.palette.warning.main, 0.15),
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <WarningAmberRoundedIcon sx={{ fontSize: 18, color: 'warning.main' }} />
                            </Box>

                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'warning.dark', lineHeight: 1.3 }}>
                                {t('add_incident.perimeter_title')}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mt: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                title={perimeterWarning.location}
                              >
                                {t('add_incident.perimeter_conflict_name')}{' '}
                                <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                  "{perimeterWarning.location}"
                                </Box>
                              </Typography>
                            </Box>

                            {/* Distance chip */}
                            <Box
                              sx={{
                                flexShrink: 0,
                                px: 1.2, py: 0.4,
                                borderRadius: '100px',
                                bgcolor: alpha(theme.palette.warning.main, 0.18),
                                border: `1px solid ${alpha(theme.palette.warning.main, 0.35)}`,
                                display: 'flex', alignItems: 'center', gap: 0.5,
                              }}
                            >
                              <MyLocationRoundedIcon sx={{ fontSize: 11, color: 'warning.dark' }} />
                              <Typography sx={{ fontSize: 11, fontWeight: 800, color: 'warning.dark', lineHeight: 1 }}>
                                {Math.round(perimeterWarning.distanceM)}m
                              </Typography>
                            </Box>
                          </Stack>

                          {/* Footer hint */}
                          <Box
                            sx={{
                              px: 2, py: 1,
                              borderTop: `1px dashed ${alpha(theme.palette.warning.main, 0.3)}`,
                              display: 'flex', alignItems: 'center', gap: 0.75,
                            }}
                          >
                            <PlaceRoundedIcon sx={{ fontSize: 13, color: 'warning.main', flexShrink: 0 }} />
                            <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.4 }}>
                              {t('add_incident.perimeter_hint')}
                            </Typography>
                          </Box>
                        </Box>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Grid>

                {/* Fields â€” right side */}
                <Grid item xs={12} md={5} lg={4}>
                  <motion.div variants={fieldParent} initial="initial" animate="animate">
                  <Stack spacing={2}>
                    {/* Date & Time */}
                    <motion.div variants={fieldChild}>
                    <Box>
                      <SectionHeader label={t('add_incident.section_location')} />
                      <Stack spacing={2}>
                        <Grid container spacing={1.5}>
                          <Grid item xs={6}>
                            <TextField
                              size="small"
                              type="date"
                              label={t('add_incident.accident_date')}
                              value={form.accidentDate}
                              onChange={(e) => setValue('accidentDate', e.target.value)}
                              InputLabelProps={{ shrink: true }}
                              required
                              fullWidth
                                                         />
                          </Grid>
                          <Grid item xs={6}>
                            <TextField
                              size="small"
                              type="time"
                              label={t('add_incident.accident_time')}
                              value={form.infoDetails.accidentTime}
                              onChange={(e) => setValue('infoDetails.accidentTime', e.target.value)}
                              InputLabelProps={{ shrink: true }}
                              required
                              fullWidth
                                                         />
                          </Grid>
                        </Grid>

                        <TextField
                          size="small"
                          label={t('add_incident.summary')}
                          placeholder={t('add_incident.summary_placeholder')}
                          value={form.infoDetails.summary}
                          onChange={(e) => setValue('infoDetails.summary', e.target.value)}
                          fullWidth
                          required
                          multiline
                          minRows={2}
                          maxRows={4}
                          error={showErrors && !form.infoDetails.summary.trim()}
                          helperText={showErrors && !form.infoDetails.summary.trim() ? t('add_incident.field_required') : undefined}
                                                 />

                        <Grid container spacing={1.5}>
                          <Grid item xs={6}>
                            <TextField size="small" label={t('add_incident.governorate')} value={form.infoDetails.governorate} onChange={(e) => setValue('infoDetails.governorate', e.target.value)} fullWidth />
                          </Grid>
                          <Grid item xs={6}>
                            <TextField size="small" label={t('add_incident.delegation')} value={form.infoDetails.delegation} onChange={(e) => setValue('infoDetails.delegation', e.target.value)} fullWidth />
                          </Grid>
                          <Grid item xs={6}>
                            <TextField size="small" label={t('add_incident.municipality')} value={form.infoDetails.municipality} onChange={(e) => setValue('infoDetails.municipality', e.target.value)} fullWidth />
                          </Grid>
                          <Grid item xs={6}>
                            <TextField size="small" label={t('add_incident.sector')} value={form.infoDetails.sector} onChange={(e) => setValue('infoDetails.sector', e.target.value)} fullWidth />
                          </Grid>
                        </Grid>
                      </Stack>
                    </Box>
                    </motion.div>

                    <motion.div variants={fieldChild}><Divider /></motion.div>

                    {/* Context */}
                    <motion.div variants={fieldChild}>
                    <Box>
                      <SectionHeader label={t('add_incident.section_context')} color="secondary" />
                      <Stack spacing={1.5}>
                        {renderEnum('infoDetails.reference', t('add_incident.reference'), REFERENCE_OPTIONS)}
                        {renderEnum('infoDetails.dayTypeId', t('add_incident.day_type'), DAY_TYPE_OPTIONS)}
                        {renderEnum('infoDetails.accidentSituationId', t('add_incident.situation'), ACCIDENT_SITUATION_OPTIONS)}
                        <Grid container spacing={1.5}>
                          <Grid item xs={6}>{renderEnum('infoDetails.zoneId', t('add_incident.zone'), ZONE_OPTIONS)}</Grid>
                          <Grid item xs={6}>{renderEnum('infoDetails.urbanityId', t('add_incident.urbanity'), URBANITY_OPTIONS)}</Grid>
                        </Grid>
                        <FormControlLabel
                          control={
                            <Switch
                              size="small"
                              checked={form.infoDetails.schoolPoint}
                              onChange={(e) => setValue('infoDetails.schoolPoint', e.target.checked)}
                                                         />
                          }
                          label={
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {t('add_incident.school_point')}
                            </Typography>
                          }
                        />
                      </Stack>
                    </Box>
                    </motion.div>
                  </Stack>
                  </motion.div>
                </Grid>
              </Grid>
            )}

            {/* â”€â”€ Step 1: Road & Environment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {step === 1 && (
              <Stack spacing={3}>
                {/* Road Conditions */}
                <Box>
                  <SectionHeader label={t('add_incident.section_road')} />
                  <Stack spacing={2}>
                    <TextField
                      size="small"
                      label={t('add_incident.road_name')}
                      value={form.roadConditions.roadName}
                      onChange={(e) => setValue('roadConditions.roadName', e.target.value)}
                      fullWidth
                      required
                      error={showErrors && !form.roadConditions.roadName.trim()}
                      helperText={showErrors && !form.roadConditions.roadName.trim() ? t('add_incident.field_required') : undefined}
                    />
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={4}>
                        <TextField
                          size="small"
                          label={t('add_incident.locality')}
                          value={form.roadConditions.locality}
                          onChange={(e) => setValue('roadConditions.locality', e.target.value)}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={4}>
                        <TextField
                          size="small"
                          label={t('add_incident.road_nature')}
                          value={form.roadConditions.roadNature}
                          onChange={(e) => setValue('roadConditions.roadNature', e.target.value)}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={4}>
                        <TextField
                          size="small"
                          label={t('add_incident.pk')}
                          placeholder="e.g. 12+500"
                          value={form.roadConditions.pk}
                          onChange={(e) => setValue('roadConditions.pk', e.target.value)}
                          fullWidth
                        />
                      </Grid>
                    </Grid>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={4}>{renderEnum('roadConditions.roadTypeId', t('add_incident.road_type'), ROAD_TYPE_OPTIONS)}</Grid>
                      <Grid item xs={12} sm={6} md={4}>{renderEnum('roadConditions.networkCategoryId', t('add_incident.network_category'), NETWORK_CATEGORY_OPTIONS)}</Grid>
                      <Grid item xs={12} sm={6} md={4}>{renderEnum('roadConditions.trafficRegimeId', t('add_incident.traffic_regime'), TRAFFIC_REGIME_OPTIONS)}</Grid>
                      <Grid item xs={12} sm={6} md={4}>{renderEnum('roadConditions.trafficDirectionId', t('add_incident.traffic_direction'), TRAFFIC_DIRECTION_OPTIONS)}</Grid>
                      <Grid item xs={12} sm={6} md={4}>{renderEnum('roadConditions.roadWidthId', t('add_incident.road_width'), ROAD_WIDTH_OPTIONS)}</Grid>
                      <Grid item xs={12} sm={6} md={4}>{renderEnum('roadConditions.laneWidthId', t('add_incident.lane_width'), LANE_WIDTH_OPTIONS)}</Grid>
                      <Grid item xs={12} sm={6} md={4}>{renderEnum('roadConditions.roadSinuosityId', t('add_incident.sinuosity'), ROAD_SINUOSITY_OPTIONS)}</Grid>
                      <Grid item xs={12} sm={6} md={4}>{renderEnum('roadConditions.roadMarkingId', t('add_incident.marking'), ROAD_MARKING_OPTIONS)}</Grid>
                      <Grid item xs={12} sm={6} md={4}>{renderEnum('roadConditions.planLayoutId', t('add_incident.plan_layout'), PLAN_LAYOUT_OPTIONS)}</Grid>
                    </Grid>
                  </Stack>
                </Box>

                <Divider />

                {/* Environment */}
                <Box>
                  <SectionHeader label={t('add_incident.section_environment')} color="info" />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>{renderEnum('environmentConditions.luminosityId', t('add_incident.luminosity'), LUMINOSITY_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={3}>{renderEnum('environmentConditions.atmosphericConditionsId', t('add_incident.atmospheric'), ATMOSPHERIC_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={3}>{renderEnum('environmentConditions.visibilityId', t('add_incident.visibility'), VISIBILITY_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={3}>{renderEnum('environmentConditions.roadPavementConditionId', t('add_incident.pavement'), ROAD_PAVEMENT_OPTIONS)}</Grid>
                  </Grid>
                </Box>
              </Stack>
            )}

            {/* â”€â”€ Step 2: Participant & Outcome â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {step === 2 && (
              <Stack spacing={3}>
                {/* Identity */}
                <Box>
                  <SectionHeader label={t('add_incident.section_participant')} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}><TextField size="small" label={t('add_incident.first_name')} value={form.participant.firstName} onChange={(e) => setValue('participant.firstName', e.target.value)} fullWidth /></Grid>
                    <Grid item xs={12} sm={6} md={3}><TextField size="small" label={t('add_incident.last_name')} value={form.participant.lastName} onChange={(e) => setValue('participant.lastName', e.target.value)} fullWidth /></Grid>
                    <Grid item xs={12} sm={6} md={3}><TextField size="small" label={t('add_incident.cin')} value={form.participant.cin} onChange={(e) => setValue('participant.cin', e.target.value)} fullWidth /></Grid>
                    <Grid item xs={12} sm={6} md={3}><TextField size="small" label={t('add_incident.registration_number')} value={form.participant.registrationNumber} onChange={(e) => setValue('participant.registrationNumber', e.target.value)} fullWidth /></Grid>
                    <Grid item xs={12} sm={6} md={3}>{renderEnum('participant.participantType', t('add_incident.participant_type'), PARTICIPANT_TYPE_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={3}>{renderEnum('participant.gender', t('add_incident.gender'), GENDER_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={3}><TextField size="small" type="number" label={t('add_incident.age')} value={form.participant.age} onChange={(e) => setValue('participant.age', e.target.value)} fullWidth inputProps={{ min: 0, max: 120 }} /></Grid>
                    <Grid item xs={12} sm={6} md={3}><TextField size="small" label={t('add_incident.driver_nationality')} value={form.participant.driverNationality} onChange={(e) => setValue('participant.driverNationality', e.target.value)} fullWidth /></Grid>
                    <Grid item xs={12} sm={6} md={3}>{renderEnum('participant.licenseStatus', t('add_incident.license_status'), LICENSE_STATUS_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={3}><TextField size="small" type="date" label={t('add_incident.license_issue_date')} value={form.participant.licenseIssueDate} onChange={(e) => setValue('participant.licenseIssueDate', e.target.value)} fullWidth InputLabelProps={{ shrink: true }} /></Grid>
                    <Grid item xs={12} sm={6} md={3}>{renderEnum('participant.continuousDrivingHoursId', t('add_incident.continuous_driving'), CONTINUOUS_DRIVING_OPTIONS)}</Grid>
                  </Grid>
                </Box>

                <Divider />

                {/* Vehicle */}
                <Box>
                  <SectionHeader label={t('add_incident.section_vehicle')} color="warning" />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>{renderEnum('participant.vehicleType', t('add_incident.vehicle_type'), VEHICLE_TYPE_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={4}>{renderEnum('participant.specialType', t('add_incident.special_type'), SPECIAL_TYPE_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={4}>{renderEnum('participant.insurance', t('add_incident.insurance'), INSURANCE_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={4}>{renderEnum('participant.vehiclePosition', t('add_incident.vehicle_position'), VEHICLE_POSITION_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={4}>{renderEnum('participant.pedestrianLocation', t('add_incident.pedestrian_location'), PEDESTRIAN_LOCATION_OPTIONS)}</Grid>
                  </Grid>
                </Box>

                <Divider />

                {/* Behavior & Tests */}
                <Box>
                  <SectionHeader label={t('add_incident.section_behavior')} color="error" />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>{renderEnum('participant.action', t('add_incident.action'), ACTION_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={4}>{renderEnum('participant.travelReason', t('add_incident.travel_reason'), TRAVEL_REASON_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={4}>{renderEnum('participant.plannedTrip', t('add_incident.planned_trip'), PLANNED_TRIP_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={4}>{renderEnum('participant.safetyEquipmentUse', t('add_incident.safety_equipment'), SAFETY_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={4}>{renderEnum('participant.injurySeverity', t('add_incident.injury_severity'), INJURY_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={4}>{renderEnum('participant.infraction', t('add_incident.infraction'), INFRACTION_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={4}>{renderEnum('participant.speedInfraction', t('add_incident.speed_infraction'), SPEED_INFRACTION_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={4}>{renderEnum('participant.adminInfraction', t('add_incident.admin_infraction'), ADMIN_INFRACTION_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={4}>{renderEnum('participant.otherInfraction', t('add_incident.other_infraction'), OTHER_INFRACTION_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={4}>{renderEnum('participant.pedestrianInfraction', t('add_incident.pedestrian_infraction'), PEDESTRIAN_INFRACTION_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={3}>{renderEnum('participant.alcoholTest', t('add_incident.alcohol_test'), ALCOHOL_OPTIONS)}</Grid>
                    <Grid item xs={12} sm={6} md={3}>{renderEnum('participant.drugTest', t('add_incident.drug_test'), DRUG_OPTIONS)}</Grid>
                  </Grid>
                </Box>

                <Divider />

                {/* Accident Outcome */}
                <Box>
                  <SectionHeader label={t('add_incident.section_damages')} color="error" />
                  <Stack spacing={2}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={6} md={4}>{renderEnum('damagesReport.accidentCauseId', t('add_incident.accident_cause'), ACCIDENT_CAUSE_OPTIONS)}</Grid>
                      <Grid item xs={12} sm={6} md={4}>{renderEnum('damagesReport.accidentCauseId2', t('add_incident.accident_cause_2'), ACCIDENT_CAUSE_OPTIONS)}</Grid>
                      <Grid item xs={12} sm={6} md={4}>{renderEnum('damagesReport.accidentTypeId', t('add_incident.accident_type'), ACCIDENT_TYPE_OPTIONS)}</Grid>
                      <Grid item xs={12} sm={6} md={4}>{renderEnum('damagesReport.accidentSubTypeId', t('add_incident.accident_subtype'), ACCIDENT_SUBTYPE_OPTIONS)}</Grid>
                    </Grid>

                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        bgcolor: alpha(theme.palette.error.main, 0.05),
                        border: `1px solid ${alpha(theme.palette.error.main, 0.15)}`,
                      }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {t('add_incident.fatal_accident')}
                        </Typography>
                        <Switch
                          size="small"
                          checked={form.damagesReport.fatalAccident}
                          onChange={(e) => setValue('damagesReport.fatalAccident', e.target.checked)}
                          color="error"
                                                 />
                      </Stack>
                      <Grid container spacing={1.5}>
                        <Grid item xs={6} sm={3}>
                          <TextField
                            size="small"
                            type="number"
                            label={t('add_incident.dead')}
                            value={form.damagesReport.deadCount}
                            onChange={(e) => setValue('damagesReport.deadCount', Number(e.target.value) || 0)}
                            fullWidth
                            inputProps={{ min: 0 }}
                            sx={{ '& .MuiOutlinedInput-root': { borderColor: alpha(theme.palette.error.main, 0.3) } }}
                                                     />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <TextField
                            size="small"
                            type="number"
                            label={t('add_incident.hospitalized')}
                            value={form.damagesReport.hospitalizedInjuredCount}
                            onChange={(e) => setValue('damagesReport.hospitalizedInjuredCount', Number(e.target.value) || 0)}
                            fullWidth
                            inputProps={{ min: 0 }}
                                                     />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <TextField
                            size="small"
                            type="number"
                            label={t('add_incident.light_injured')}
                            value={form.damagesReport.lightlyInjuredCount}
                            onChange={(e) => setValue('damagesReport.lightlyInjuredCount', Number(e.target.value) || 0)}
                            fullWidth
                            inputProps={{ min: 0 }}
                                                     />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <TextField
                            size="small"
                            type="number"
                            label={t('add_incident.unharmed')}
                            value={form.damagesReport.unharmedCount}
                            onChange={(e) => setValue('damagesReport.unharmedCount', Number(e.target.value) || 0)}
                            fullWidth
                            inputProps={{ min: 0 }}
                                                     />
                        </Grid>
                      </Grid>
                    </Box>

                    <TextField
                      size="small"
                      label={t('add_incident.damage_description')}
                      placeholder={t('add_incident.damage_description_placeholder')}
                      value={form.damagesReport.damageDescription}
                      onChange={(e) => setValue('damagesReport.damageDescription', e.target.value)}
                      fullWidth
                      multiline
                      minRows={2}
                      maxRows={4}
                    />
                  </Stack>
                </Box>
              </Stack>
            )}
          </motion.div>
          </AnimatePresence>

          {/* Documents panel â€” always at bottom of step 2 */}
          {step === 2 && (
            <Box sx={{ mt: 3 }}>
              <Divider sx={{ mb: 3 }} />
              <IncidentDocumentsPanel
                accidentId={isEditMode ? String(initialData?.id || '') || null : null}
                scopeKey={documentScopeKey}
                enabled={documentsEnabled}
              />
            </Box>
          )}
          </>
      </DialogContent>

      {/* â”€â”€ Sticky footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 2,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
          boxShadow: `0 -8px 32px ${alpha(theme.palette.common.black, 0.07)}`,
          bgcolor: 'background.paper',
          position: 'sticky',
          bottom: 0,
          zIndex: theme.zIndex.modal + 6,
        }}
      >
        {/* Perimeter conflict reminder in footer (visible on step 1 and 2) */}
        <AnimatePresence>
          {perimeterWarning && !isEditMode && step > 0 && (
            <motion.div
              key="footer-perimeter"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto', transition: { duration: 0.2 } }}
              exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
            >
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                  mb: 1.5, px: 1.5, py: 1,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.warning.main, 0.08),
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                }}
              >
                <WarningAmberRoundedIcon sx={{ fontSize: 15, color: 'warning.main', flexShrink: 0 }} />
                <Typography variant="caption" sx={{ color: 'warning.dark', fontWeight: 600, flex: 1 }}>
                  {t('add_incident.perimeter_title')} — {t('add_incident.perimeter_footer_hint')}
                </Typography>
                <Button
                  size="small"
                  onClick={() => { setStepDirection(-1); setStep(0) }}
                  sx={{ fontSize: 11, fontWeight: 700, textTransform: 'none', color: 'warning.dark', py: 0.25, minWidth: 0 }}
                >
                  {t('add_incident.perimeter_go_back')}
                </Button>
              </Stack>
            </motion.div>
          )}
        </AnimatePresence>

        <Stack direction="row" justifyContent="space-between" alignItems="center">
            {/* Back */}
            <motion.span
              whileTap={step === 0 ? undefined : { scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              style={{ display: 'inline-flex' }}
            >
              <Button
                variant="outlined"
                startIcon={<ArrowBackRoundedIcon />}
                onClick={goBack}
                disabled={step === 0}
                sx={{ borderRadius: 100, fontWeight: 600, textTransform: 'none', minWidth: 100 }}
              >
                {t('add_incident.back')}
              </Button>
            </motion.span>

            {/* Cancel + Continue/Submit */}
            <Stack direction="row" spacing={1.5} alignItems="center">
              <motion.span
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                style={{ display: 'inline-flex' }}
              >
                <Button
                  onClick={handleClose}
                  sx={{ borderRadius: 100, fontWeight: 600, textTransform: 'none', color: 'text.secondary' }}
                >
                  {t('add_incident.cancel')}
                </Button>
              </motion.span>

              <AnimatePresence mode="wait" initial={false}>
                {step < steps.length - 1 ? (
                  <motion.span
                    key="continue"
                    ref={continueButtonRef}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0, transition: { duration: 0.18, ease: easeOut } }}
                    exit={{ opacity: 0, x: -8, transition: { duration: 0.12, ease: easeIn } }}
                    whileTap={!stepIsValid ? undefined : { scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    style={{ display: 'inline-flex' }}
                  >
                    <Button
                      variant="contained"
                      onClick={goNext}
                      disabled={!stepIsValid}
                      endIcon={<ArrowForwardRoundedIcon />}
                      sx={{
                        borderRadius: 100,
                        fontWeight: 700,
                        textTransform: 'none',
                        minWidth: 130,
                        boxShadow: stepIsValid ? `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}` : 'none',
                        transition: 'box-shadow 0.2s ease',
                      }}
                    >
                      {t('add_incident.continue')}
                    </Button>
                  </motion.span>
                ) : (
                  <motion.span
                    key="submit"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0, transition: { duration: 0.18, ease: easeOut } }}
                    exit={{ opacity: 0, x: -8, transition: { duration: 0.12, ease: easeIn } }}
                    whileTap={!canSubmit || submitting ? undefined : { scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    style={{ display: 'inline-flex' }}
                  >
                    <Button
                      variant="contained"
                      color="success"
                      onClick={handleSubmit}
                      disabled={!canSubmit || submitting || (!isEditMode && !!perimeterWarning)}
                      startIcon={submitting ? undefined : <CheckCircleRoundedIcon />}
                      sx={{
                        borderRadius: 100,
                        fontWeight: 700,
                        textTransform: 'none',
                        minWidth: 160,
                        boxShadow: canSubmit && !submitting ? `0 4px 14px ${alpha(theme.palette.success.main, 0.3)}` : 'none',
                        transition: 'box-shadow 0.2s ease',
                      }}
                    >
                      {submitting ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box
                            component="span"
                            sx={{
                              width: 14, height: 14, borderRadius: '50%',
                              border: '2px solid currentColor',
                              borderTopColor: 'transparent',
                              animation: 'spin 0.7s linear infinite',
                              '@keyframes spin': { to: { transform: 'rotate(360deg)' } },
                            }}
                          />
                          <span>{t('add_incident.submitting')}</span>
                        </Stack>
                      ) : (
                        isEditMode ? t('add_incident.update') : t('add_incident.submit')
                      )}
                    </Button>
                  </motion.span>
                )}
              </AnimatePresence>
            </Stack>
          </Stack>
      </Box>
    </Dialog>

    {/* Discard-changes confirmation */}
    <Dialog
      open={confirmDiscardOpen}
      onClose={() => setConfirmDiscardOpen(false)}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, p: 0.5 } }}
    >
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        {t('add_incident.discard_title')}
      </DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" variant="body2">
          {t('add_incident.discard_body')}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button
          onClick={() => setConfirmDiscardOpen(false)}
          sx={{ borderRadius: 100, textTransform: 'none', fontWeight: 600 }}
        >
          {t('add_incident.discard_cancel')}
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleDiscardConfirm}
          sx={{ borderRadius: 100, textTransform: 'none', fontWeight: 700 }}
        >
          {t('add_incident.discard_confirm')}
        </Button>
      </DialogActions>
    </Dialog>
    </>
  )
}

