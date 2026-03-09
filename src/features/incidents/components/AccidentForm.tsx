import React, { useState } from 'react'
import {
  Box,
  Stack,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Button,
  Divider,
  GridLegacy as Grid,
  IconButton,
  FormHelperText,
  Alert,
  CircularProgress,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  AccidentFormState,
  AccidentTypeCode,
  AccidentCauseCode,
  VehicleTypeCode,
  ParticipantTypeCode,
  DayTypeCode,
  LuminosityCode,
  AtmosphericConditionsCode,
  VisibilityCode,
  RoadTypeCode,
  NetworkCategoryCode,
  ZoneCode,
  UrbanityCode,
  RoadSinuosityCode,
  RoadMarkingCode,
  PlanLayoutCode,
  RoadWidthCode,
  LaneWidthCode,
  RoadPavementCode,
  TrafficRegimeCode,
  TrafficDirectionCode,
  SafetyEquipmentCode,
  InjurySeverityCode,
  AlcoholTestCode,
  DrugTestCode,
  InfractionCode,
  TravelReasonCode,
  PlannedTripCode,
  SpecialTypeCode,
  InsuranceCode,
  VehiclePositionCode,
  PedestrianLocationCode,
  ActionCode,
  DamageSeverityCode,
  VehicleInfo,
  ParticipantInfo,
} from '@/types/accident'

interface AccidentFormProps {
  onSubmit: (data: AccidentFormState) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

const ACCIDENT_TYPE_OPTIONS: { value: AccidentTypeCode; label: string }[] = [
  { value: 'COLLISION_MOVING', label: 'Collision with moving vehicle' },
  { value: 'COLLISION_OBSTACLE', label: 'Collision with obstacle' },
  { value: 'COLLISION_PEDESTRIAN_ANIMAL', label: 'Collision with pedestrian/animal' },
  { value: 'ROLLOVER_ON_ROADWAY', label: 'Rollover on roadway' },
  { value: 'RUNOFF_LEFT_COLLISION', label: 'Run-off left with collision' },
  { value: 'RUNOFF_RIGHT_COLLISION', label: 'Run-off right with collision' },
  { value: 'RUNOFF_LEFT_NO_COLLISION', label: 'Run-off left without collision' },
  { value: 'RUNOFF_RIGHT_NO_COLLISION', label: 'Run-off right without collision' },
  { value: 'OTHER', label: 'Other' },
]

const ACCIDENT_CAUSE_OPTIONS: { value: AccidentCauseCode; label: string }[] = [
  { value: 'INATTENTION', label: 'Inattention' },
  { value: 'INAPPROPRIATE_SPEED', label: 'Inappropriate speed' },
  { value: 'INFRACTION', label: 'Infraction' },
  { value: 'INEXPERIENCE', label: 'Inexperience' },
  { value: 'FATIGUE', label: 'Fatigue' },
  { value: 'ALCOHOL_DRUGS', label: 'Alcohol/Drugs' },
  { value: 'ILLNESS', label: 'Illness' },
  { value: 'ROAD_CONDITION', label: 'Road condition' },
  { value: 'SIGNAGE_CONDITION', label: 'Signage condition' },
  { value: 'VEHICLE_CONDITION', label: 'Vehicle condition' },
  { value: 'BREAKDOWN', label: 'Breakdown' },
  { value: 'OVERLOAD', label: 'Overload' },
  { value: 'ADVERSE_WEATHER', label: 'Adverse weather' },
  { value: 'GLARE', label: 'Glare' },
  { value: 'ANIMAL', label: 'Animal' },
  { value: 'OTHER', label: 'Other' },
  { value: 'NO_OPINION', label: 'No opinion' },
]

const VEHICLE_TYPE_OPTIONS: { value: VehicleTypeCode; label: string }[] = [
  { value: 'BICYCLE', label: 'Bicycle' },
  { value: 'MOPED', label: 'Moped' },
  { value: 'QUAD_50', label: 'Quad 50cc' },
  { value: 'TRICYCLE', label: 'Tricycle' },
  { value: 'MOTO_50_125', label: 'Motorcycle 50-125cc' },
  { value: 'MOTO_125', label: 'Motorcycle 125cc' },
  { value: 'QUAD_50_PLUS', label: 'Quad 50cc+' },
  { value: 'VEHICLE_ALONE', label: 'Vehicle alone' },
  { value: 'VEHICLE_TRAILER', label: 'Vehicle with trailer' },
  { value: 'VAN', label: 'Van' },
  { value: 'LIGHT_TRUCK_3_5T', label: 'Light truck 3.5t' },
  { value: 'BUS_LINE', label: 'Bus line' },
  { value: 'BUS_OTHER', label: 'Bus other' },
  { value: 'TRAIN', label: 'Train' },
  { value: 'OTHER', label: 'Other' },
]

const PARTICIPANT_TYPE_OPTIONS: { value: ParticipantTypeCode; label: string }[] = [
  { value: 'DRIVER', label: 'Driver' },
  { value: 'PASSENGER', label: 'Passenger' },
  { value: 'PEDESTRIAN', label: 'Pedestrian' },
  { value: 'WITNESS', label: 'Witness' },
  { value: 'OWNER', label: 'Owner' },
  { value: 'LEGAL_GUARDIAN', label: 'Legal guardian' },
]

const DAY_TYPE_OPTIONS: { value: DayTypeCode; label: string }[] = [
  { value: 'WORKING', label: 'Working day' },
  { value: 'BEFORE_HOLIDAY', label: 'Before holiday' },
  { value: 'HOLIDAY', label: 'Holiday' },
  { value: 'AFTER_HOLIDAY', label: 'After holiday' },
]

const LUMINOSITY_OPTIONS: { value: LuminosityCode; label: string }[] = [
  { value: 'FULL_DAYLIGHT', label: 'Full daylight' },
  { value: 'TWILIGHT_DAWN', label: 'Twilight/Dawn' },
  { value: 'NIGHT_NO_PUBLIC_LIGHTING', label: 'Night no public lighting' },
  { value: 'NIGHT_LIGHTING_OFF', label: 'Night lighting off' },
  { value: 'NIGHT_LIGHTING_ON', label: 'Night lighting on' },
  { value: 'NIGHT_SUFFICIENT_LIGHTING', label: 'Night sufficient lighting' },
  { value: 'INSUFFICIENT', label: 'Insufficient' },
]

const ATMOSPHERIC_CONDITIONS_OPTIONS: { value: AtmosphericConditionsCode; label: string }[] = [
  { value: 'GOOD_WEATHER', label: 'Good weather' },
  { value: 'LIGHT_RAIN', label: 'Light rain' },
  { value: 'HEAVY_RAIN', label: 'Heavy rain' },
  { value: 'FOG_SMOKE', label: 'Fog/Smoke' },
  { value: 'WIND', label: 'Wind' },
  { value: 'SNOW', label: 'Snow' },
  { value: 'OTHER', label: 'Other' },
]

const VISIBILITY_OPTIONS: { value: VisibilityCode; label: string }[] = [
  { value: 'CLEAR', label: 'Clear' },
  { value: 'NOT_CLEAR', label: 'Not clear' },
  { value: 'FOG', label: 'Fog' },
  { value: 'NIGHT', label: 'Night' },
  { value: 'OTHER', label: 'Other' },
]

const ROAD_TYPE_OPTIONS: { value: RoadTypeCode; label: string }[] = [
  { value: 'TOLL_HIGHWAY', label: 'Toll highway' },
  { value: 'FREE_HIGHWAY', label: 'Free highway' },
  { value: 'EXPRESS', label: 'Express' },
  { value: 'DUAL_CARRIAGEWAY', label: 'Dual carriageway' },
  { value: 'CONVENTIONAL_2X1', label: 'Conventional 2x1' },
  { value: 'CONVENTIONAL_ADDITIONAL', label: 'Conventional additional' },
  { value: 'INTERCHANGE_RAMP', label: 'Interchange ramp' },
  { value: 'AGRICULTURAL', label: 'Agricultural' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'OTHER', label: 'Other' },
]

const NETWORK_CATEGORY_OPTIONS: { value: NetworkCategoryCode; label: string }[] = [
  { value: 'HIGHWAY', label: 'Highway' },
  { value: 'NATIONAL', label: 'National' },
  { value: 'REGIONAL', label: 'Regional' },
  { value: 'LOCAL', label: 'Local' },
  { value: 'COMMUNAL', label: 'Communal' },
  { value: 'UNCLASSIFIED', label: 'Unclassified' },
]

const ZONE_OPTIONS: { value: ZoneCode; label: string }[] = [
  { value: 'ROAD', label: 'Road' },
  { value: 'URBAN', label: 'Urban' },
  { value: 'CROSSING', label: 'Crossing' },
  { value: 'BYPASS', label: 'Bypass' },
]

const URBANITY_OPTIONS: { value: UrbanityCode; label: string }[] = [
  { value: 'IN_AGGLOMERATION', label: 'In agglomeration' },
  { value: 'OUTSIDE_AGGLOMERATION', label: 'Outside agglomeration' },
]

const SAFETY_EQUIPMENT_OPTIONS: { value: SafetyEquipmentCode; label: string }[] = [
  { value: 'SEATBELT', label: 'Seatbelt' },
  { value: 'HELMET', label: 'Helmet' },
  { value: 'CHILD_SEAT', label: 'Child seat' },
  { value: 'NONE', label: 'None' },
  { value: 'UNKNOWN', label: 'Unknown' },
]

const INJURY_SEVERITY_OPTIONS: { value: InjurySeverityCode; label: string }[] = [
  { value: 'UNINJURED', label: 'Uninjured' },
  { value: 'LIGHT_INJURY', label: 'Light injury' },
  { value: 'SERIOUS_INJURY', label: 'Serious injury' },
  { value: 'FATAL', label: 'Fatal' },
]

const ALCOHOL_TEST_OPTIONS: { value: AlcoholTestCode; label: string }[] = [
  { value: 'NOT_DONE', label: 'Not done' },
  { value: 'NEGATIVE', label: 'Negative' },
  { value: 'POSITIVE', label: 'Positive' },
  { value: 'REFUSED', label: 'Refused' },
]

const DRUG_TEST_OPTIONS: { value: DrugTestCode; label: string }[] = [
  { value: 'NOT_DONE', label: 'Not done' },
  { value: 'NEGATIVE', label: 'Negative' },
  { value: 'POSITIVE', label: 'Positive' },
  { value: 'REFUSED', label: 'Refused' },
]

const INFRACTION_OPTIONS: { value: InfractionCode; label: string }[] = [
  { value: 'NONE', label: 'None' },
  { value: 'SPEEDING', label: 'Speeding' },
  { value: 'RED_LIGHT', label: 'Red light' },
  { value: 'STOP_SIGN', label: 'Stop sign' },
  { value: 'WRONG_WAY', label: 'Wrong way' },
  { value: 'NO_LICENSE', label: 'No license' },
  { value: 'DUI', label: 'DUI' },
  { value: 'PHONE_USE', label: 'Phone use' },
  { value: 'OTHER', label: 'Other' },
]

const TRAVEL_REASON_OPTIONS: { value: TravelReasonCode; label: string }[] = [
  { value: 'HOME_WORK', label: 'Home to work' },
  { value: 'WORK_HOME', label: 'Work to home' },
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'SCHOOL', label: 'School' },
  { value: 'SHOPPING', label: 'Shopping' },
  { value: 'LEISURE', label: 'Leisure' },
  { value: 'OTHER', label: 'Other' },
]

const PLANNED_TRIP_OPTIONS: { value: PlannedTripCode; label: string }[] = [
  { value: 'LESS_5KM', label: 'Less than 5km' },
  { value: 'FROM_5_TO_25KM', label: '5 to 25km' },
  { value: 'FROM_25_TO_50KM', label: '25 to 50km' },
  { value: 'FROM_50_TO_100KM', label: '50 to 100km' },
  { value: 'MORE_100KM', label: 'More than 100km' },
  { value: 'UNKNOWN', label: 'Unknown' },
]

const SPECIAL_TYPE_OPTIONS: { value: SpecialTypeCode; label: string }[] = [
  { value: 'TAXI', label: 'Taxi' },
  { value: 'AMBULANCE', label: 'Ambulance' },
  { value: 'FIREFIGHTER', label: 'Firefighter' },
  { value: 'POLICE', label: 'Police' },
  { value: 'SCHOOL_TRANSPORT', label: 'School transport' },
  { value: 'DANGEROUS_GOODS', label: 'Dangerous goods' },
  { value: 'ROAD_MAINTENANCE', label: 'Road maintenance' },
  { value: 'NONE', label: 'None' },
]

const INSURANCE_OPTIONS: { value: InsuranceCode; label: string }[] = [
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
  { value: 'NOT_PRESENT', label: 'Not present' },
]

const VEHICLE_POSITION_OPTIONS: { value: VehiclePositionCode; label: string }[] = [
  { value: 'FRONT_LEFT', label: 'Front left' },
  { value: 'FRONT_RIGHT', label: 'Front right' },
  { value: 'REAR_LEFT', label: 'Rear left' },
  { value: 'REAR_RIGHT', label: 'Rear right' },
  { value: 'REAR_CENTER', label: 'Rear center' },
  { value: 'OTHER', label: 'Other' },
]

const DAMAGE_SEVERITY_OPTIONS: { value: DamageSeverityCode; label: string }[] = [
  { value: 'LIGHT', label: 'Light' },
  { value: 'SEVERE', label: 'Severe' },
]

const initialFormState: AccidentFormState = {
  location: {
    latitude: 0,
    longitude: 0,
    description: '',
    roadReference: '',
    kilometerMarker: '',
  },
  time: new Date().toISOString(),
  dayType: 'WORKING',
  situation: 'ON_ROAD',
  road: {
    type: 'CONVENTIONAL_2X1',
    networkCategory: 'LOCAL',
    zone: 'ROAD',
    urbanity: 'OUTSIDE_AGGLOMERATION',
    sinuosity: 'UNIQUE',
    marking: 'NONEXISTENT',
    planLayout: 'STRAIGHT',
    width: 'LESS_325',
    laneWidth: 'LESS_6',
    pavement: 'PAVED',
    trafficRegime: 'BIDIRECTIONAL',
    trafficDirection: 'BOTH',
  },
  environmental: {
    luminosity: 'FULL_DAYLIGHT',
    atmosphericConditions: 'GOOD_WEATHER',
    visibility: 'CLEAR',
    roadSurfaceCondition: '',
    trafficConditions: '',
    constructionZone: false,
    signageVisibility: '',
  },
  vehicles: [
    {
      type: 'VEHICLE_ALONE',
      specialType: 'NONE',
      insurance: 'YES',
      position: 'FRONT_LEFT',
      damageSeverity: 'LIGHT',
    },
  ],
  participants: [
    {
      type: 'DRIVER',
      safetyEquipment: 'SEATBELT',
      injurySeverity: 'UNINJURED',
      alcoholTest: 'NOT_DONE',
      drugTest: 'NOT_DONE',
      infraction: 'NONE',
      action: 'DRIVER_STRAIGHT',
      travelReason: 'HOME_WORK',
      plannedTrip: 'LESS_5KM',
    },
  ],
  details: {
    type: 'COLLISION_MOVING',
    subType: 'FRONT',
    causes: [],
    description: '',
    casePriority: 'MEDIUM',
  },
  evidence: {
    photos: [],
    autoSaveDraft: false,
  },
  isSubmitting: false,
  errors: {},
}

export default function AccidentForm({ onSubmit, onCancel, loading = false }: AccidentFormProps) {
  const [form, setForm] = useState<AccidentFormState>(initialFormState)

  const handleLocationChange = (field: keyof typeof form.location, value: any) => {
    setForm(prev => ({
      ...prev,
      location: { ...prev.location, [field]: value }
    }))
  }

  const handleRoadChange = (field: keyof typeof form.road, value: any) => {
    setForm(prev => ({
      ...prev,
      road: { ...prev.road, [field]: value }
    }))
  }

  const handleEnvironmentalChange = (field: keyof typeof form.environmental, value: any) => {
    setForm(prev => ({
      ...prev,
      environmental: { ...prev.environmental, [field]: value }
    }))
  }

  const handleVehicleChange = (index: number, field: keyof VehicleInfo, value: any) => {
    setForm(prev => ({
      ...prev,
      vehicles: prev.vehicles.map((v, i) => i === index ? { ...v, [field]: value } : v)
    }))
  }

  const handleParticipantChange = (index: number, field: keyof ParticipantInfo, value: any) => {
    setForm(prev => ({
      ...prev,
      participants: prev.participants.map((p, i) => i === index ? { ...p, [field]: value } : p)
    }))
  }

  const handleDetailsChange = (field: keyof typeof form.details, value: any) => {
    setForm(prev => ({
      ...prev,
      details: { ...prev.details, [field]: value }
    }))
  }

  const handleEvidenceChange = (field: keyof typeof form.evidence, value: any) => {
    setForm(prev => ({
      ...prev,
      evidence: { ...prev.evidence, [field]: value }
    }))
  }

  const addVehicle = () => {
    setForm(prev => ({
      ...prev,
      vehicles: [...prev.vehicles, {
        type: 'VEHICLE_ALONE',
        specialType: 'NONE',
        insurance: 'YES',
        position: 'FRONT_LEFT',
        damageSeverity: 'LIGHT',
      }]
    }))
  }

  const removeVehicle = (index: number) => {
    setForm(prev => ({
      ...prev,
      vehicles: prev.vehicles.filter((_, i) => i !== index)
    }))
  }

  const addParticipant = () => {
    setForm(prev => ({
      ...prev,
      participants: [...prev.participants, {
        type: 'DRIVER',
        safetyEquipment: 'SEATBELT',
        injurySeverity: 'UNINJURED',
        alcoholTest: 'NOT_DONE',
        drugTest: 'NOT_DONE',
        infraction: 'NONE',
        action: 'DRIVER_STRAIGHT',
        travelReason: 'HOME_WORK',
        plannedTrip: 'LESS_5KM',
      }]
    }))
  }

  const removeParticipant = (index: number) => {
    setForm(prev => ({
      ...prev,
      participants: prev.participants.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async () => {
    try {
      setForm(prev => ({ ...prev, isSubmitting: true }))
      await onSubmit(form)
    } catch (error) {
      console.error('Error submitting accident form:', error)
      setForm(prev => ({ 
        ...prev, 
        isSubmitting: false,
        errors: { submit: 'Failed to create accident. Please try again.' }
      }))
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={4}>
        {/* Basic Information */}
        <Box>
          <Typography variant="h6" gutterBottom>
            Basic Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Location Description"
                value={form.location.description}
                onChange={(e) => handleLocationChange('description', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Latitude"
                type="number"
                value={form.location.latitude}
                onChange={(e) => handleLocationChange('latitude', parseFloat(e.target.value) || 0)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Longitude"
                type="number"
                value={form.location.longitude}
                onChange={(e) => handleLocationChange('longitude', parseFloat(e.target.value) || 0)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Road Reference"
                value={form.location.roadReference}
                onChange={(e) => handleLocationChange('roadReference', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Kilometer Marker"
                value={form.location.kilometerMarker}
                onChange={(e) => handleLocationChange('kilometerMarker', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Time"
                type="datetime-local"
                value={form.time}
                onChange={(e) => setForm(prev => ({ ...prev, time: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Day Type</InputLabel>
                <Select
                  value={form.dayType}
                  label="Day Type"
                  onChange={(e) => setForm(prev => ({ ...prev, dayType: e.target.value as DayTypeCode }))}
                >
                  {DAY_TYPE_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>

        <Divider />

        {/* Road Information */}
        <Box>
          <Typography variant="h6" gutterBottom>
            Road Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Road Type</InputLabel>
                <Select
                  value={form.road.type}
                  label="Road Type"
                  onChange={(e) => handleRoadChange('type', e.target.value as RoadTypeCode)}
                >
                  {ROAD_TYPE_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Network Category</InputLabel>
                <Select
                  value={form.road.networkCategory}
                  label="Network Category"
                  onChange={(e) => handleRoadChange('networkCategory', e.target.value as NetworkCategoryCode)}
                >
                  {NETWORK_CATEGORY_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Zone</InputLabel>
                <Select
                  value={form.road.zone}
                  label="Zone"
                  onChange={(e) => handleRoadChange('zone', e.target.value as ZoneCode)}
                >
                  {ZONE_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Urbanity</InputLabel>
                <Select
                  value={form.road.urbanity}
                  label="Urbanity"
                  onChange={(e) => handleRoadChange('urbanity', e.target.value as UrbanityCode)}
                >
                  {URBANITY_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>

        <Divider />

        {/* Environmental Conditions */}
        <Box>
          <Typography variant="h6" gutterBottom>
            Environmental Conditions
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Luminosity</InputLabel>
                <Select
                  value={form.environmental.luminosity}
                  label="Luminosity"
                  onChange={(e) => handleEnvironmentalChange('luminosity', e.target.value as LuminosityCode)}
                >
                  {LUMINOSITY_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Atmospheric Conditions</InputLabel>
                <Select
                  value={form.environmental.atmosphericConditions}
                  label="Atmospheric Conditions"
                  onChange={(e) => handleEnvironmentalChange('atmosphericConditions', e.target.value as AtmosphericConditionsCode)}
                >
                  {ATMOSPHERIC_CONDITIONS_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Visibility</InputLabel>
                <Select
                  value={form.environmental.visibility}
                  label="Visibility"
                  onChange={(e) => handleEnvironmentalChange('visibility', e.target.value as VisibilityCode)}
                >
                  {VISIBILITY_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Road Surface Condition"
                value={form.environmental.roadSurfaceCondition || ''}
                onChange={(e) => handleEnvironmentalChange('roadSurfaceCondition', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Traffic Conditions"
                value={form.environmental.trafficConditions || ''}
                onChange={(e) => handleEnvironmentalChange('trafficConditions', e.target.value)}
              />
            </Grid>
          </Grid>
        </Box>

        <Divider />

        {/* Vehicles */}
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Vehicles ({form.vehicles.length})
            </Typography>
            <Button
              startIcon={<AddIcon />}
              onClick={addVehicle}
              variant="outlined"
            >
              Add Vehicle
            </Button>
          </Stack>
          {form.vehicles.map((vehicle, index) => (
            <Box key={index} sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle2">
                  Vehicle {index + 1}
                </Typography>
                {form.vehicles.length > 1 && (
                  <IconButton onClick={() => removeVehicle(index)} color="error">
                    <DeleteIcon />
                  </IconButton>
                )}
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Vehicle Type</InputLabel>
                    <Select
                      value={vehicle.type}
                      label="Vehicle Type"
                      onChange={(e) => handleVehicleChange(index, 'type', e.target.value as VehicleTypeCode)}
                    >
                      {VEHICLE_TYPE_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Special Type</InputLabel>
                    <Select
                      value={vehicle.specialType}
                      label="Special Type"
                      onChange={(e) => handleVehicleChange(index, 'specialType', e.target.value as SpecialTypeCode)}
                    >
                      {SPECIAL_TYPE_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Insurance</InputLabel>
                    <Select
                      value={vehicle.insurance}
                      label="Insurance"
                      onChange={(e) => handleVehicleChange(index, 'insurance', e.target.value as InsuranceCode)}
                    >
                      {INSURANCE_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Position</InputLabel>
                    <Select
                      value={vehicle.position}
                      label="Position"
                      onChange={(e) => handleVehicleChange(index, 'position', e.target.value as VehiclePositionCode)}
                    >
                      {VEHICLE_POSITION_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Damage Severity</InputLabel>
                    <Select
                      value={vehicle.damageSeverity}
                      label="Damage Severity"
                      onChange={(e) => handleVehicleChange(index, 'damageSeverity', e.target.value as DamageSeverityCode)}
                    >
                      {DAMAGE_SEVERITY_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="License Plate"
                    value={vehicle.licensePlate || ''}
                    onChange={(e) => handleVehicleChange(index, 'licensePlate', e.target.value)}
                  />
                </Grid>
              </Grid>
            </Box>
          ))}
        </Box>

        <Divider />

        {/* Participants */}
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Participants ({form.participants.length})
            </Typography>
            <Button
              startIcon={<AddIcon />}
              onClick={addParticipant}
              variant="outlined"
            >
              Add Participant
            </Button>
          </Stack>
          {form.participants.map((participant, index) => (
            <Box key={index} sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle2">
                  Participant {index + 1}
                </Typography>
                {form.participants.length > 1 && (
                  <IconButton onClick={() => removeParticipant(index)} color="error">
                    <DeleteIcon />
                  </IconButton>
                )}
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Participant Type</InputLabel>
                    <Select
                      value={participant.type}
                      label="Participant Type"
                      onChange={(e) => handleParticipantChange(index, 'type', e.target.value as ParticipantTypeCode)}
                    >
                      {PARTICIPANT_TYPE_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Safety Equipment</InputLabel>
                    <Select
                      value={participant.safetyEquipment}
                      label="Safety Equipment"
                      onChange={(e) => handleParticipantChange(index, 'safetyEquipment', e.target.value as SafetyEquipmentCode)}
                    >
                      {SAFETY_EQUIPMENT_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Injury Severity</InputLabel>
                    <Select
                      value={participant.injurySeverity}
                      label="Injury Severity"
                      onChange={(e) => handleParticipantChange(index, 'injurySeverity', e.target.value as InjurySeverityCode)}
                    >
                      {INJURY_SEVERITY_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Alcohol Test</InputLabel>
                    <Select
                      value={participant.alcoholTest}
                      label="Alcohol Test"
                      onChange={(e) => handleParticipantChange(index, 'alcoholTest', e.target.value as AlcoholTestCode)}
                    >
                      {ALCOHOL_TEST_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Drug Test</InputLabel>
                    <Select
                      value={participant.drugTest}
                      label="Drug Test"
                      onChange={(e) => handleParticipantChange(index, 'drugTest', e.target.value as DrugTestCode)}
                    >
                      {DRUG_TEST_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Infraction</InputLabel>
                    <Select
                      value={participant.infraction}
                      label="Infraction"
                      onChange={(e) => handleParticipantChange(index, 'infraction', e.target.value as InfractionCode)}
                    >
                      {INFRACTION_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Travel Reason</InputLabel>
                    <Select
                      value={participant.travelReason}
                      label="Travel Reason"
                      onChange={(e) => handleParticipantChange(index, 'travelReason', e.target.value as TravelReasonCode)}
                    >
                      {TRAVEL_REASON_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Planned Trip</InputLabel>
                    <Select
                      value={participant.plannedTrip}
                      label="Planned Trip"
                      onChange={(e) => handleParticipantChange(index, 'plannedTrip', e.target.value as PlannedTripCode)}
                    >
                      {PLANNED_TRIP_OPTIONS.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Name"
                    value={participant.name || ''}
                    onChange={(e) => handleParticipantChange(index, 'name', e.target.value)}
                  />
                </Grid>
              </Grid>
            </Box>
          ))}
        </Box>

        <Divider />

        {/* Accident Details */}
        <Box>
          <Typography variant="h6" gutterBottom>
            Accident Details
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Accident Type</InputLabel>
                <Select
                  value={form.details.type}
                  label="Accident Type"
                  onChange={(e) => handleDetailsChange('type', e.target.value as AccidentTypeCode)}
                >
                  {ACCIDENT_TYPE_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Accident Causes</InputLabel>
                <Select
                  multiple
                  value={form.details.causes}
                  label="Accident Causes"
                  onChange={(e) => handleDetailsChange('causes', e.target.value as AccidentCauseCode[])}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => {
                        const option = ACCIDENT_CAUSE_OPTIONS.find(opt => opt.value === value)
                        return <Chip key={value} label={option?.label} size="small" />
                      })}
                    </Box>
                  )}
                >
                  {ACCIDENT_CAUSE_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={4}
                value={form.details.description}
                onChange={(e) => handleDetailsChange('description', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Witness Info"
                value={form.details.witnessInfo || ''}
                onChange={(e) => handleDetailsChange('witnessInfo', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Police Report Number"
                value={form.details.policeReportNumber || ''}
                onChange={(e) => handleDetailsChange('policeReportNumber', e.target.value)}
              />
            </Grid>
          </Grid>
        </Box>

        <Divider />

        {/* Evidence */}
        <Box>
          <Typography variant="h6" gutterBottom>
            Evidence
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Evidence Description"
                multiline
                rows={3}
                value={form.evidence.photos[0]?.description || ''}
                onChange={(e) => handleEvidenceChange('photos', [{ description: e.target.value }])}
              />
            </Grid>
          </Grid>
        </Box>

        {/* Error Display */}
        {form.errors.submit && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {form.errors.submit}
          </Alert>
        )}

        {/* Actions */}
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button 
            onClick={onCancel} 
            variant="outlined"
            disabled={form.isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={form.isSubmitting || loading}
            startIcon={form.isSubmitting ? <CircularProgress size={20} /> : null}
          >
            {form.isSubmitting ? 'Creating...' : 'Create Accident'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
