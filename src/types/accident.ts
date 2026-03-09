// Common types used in accident module
export type AttachmentTypeCode = 'photo' | 'sketch_png' | 'sketch_json'
export type UploadStatusCode = 'pending' | 'uploading' | 'completed' | 'failed'

// ---- Enums (semantic codes) ----

export type DayTypeCode =
  | 'WORKING'
  | 'BEFORE_HOLIDAY'
  | 'HOLIDAY'
  | 'AFTER_HOLIDAY'

export type AccidentSituationCode =
  | 'ON_ROAD'
  | 'ON_SHOULDER'
  | 'ON_VERGE'
  | 'ON_SIDEWALK'
  | 'ON_BIKE_PATH'
  | 'ON_BIKE_LANE'
  | 'OFF_PLATFORM'

export type ZoneCode = 'ROAD' | 'URBAN' | 'CROSSING' | 'BYPASS'

export type UrbanityCode = 'IN_AGGLOMERATION' | 'OUTSIDE_AGGLOMERATION'

export type RoadSinuosityCode =
  | 'UNIQUE'
  | 'RIGHT'
  | 'LEFT'
  | 'RIGHT_LEFT'
  | 'LEFT_RIGHT'
  | 'RIGHT_LEFT_RIGHT'
  | 'LEFT_RIGHT_LEFT'

export type RoadMarkingCode =
  | 'NONEXISTENT'
  | 'LANE_SEPARATION'
  | 'LANE_AND_EDGE'
  | 'EDGE_ONLY'

export type PlanLayoutCode =
  | 'STRAIGHT'
  | 'GENTLE_CURVE'
  | 'DIFFICULT_CURVE_NO_SIGN'
  | 'DIFFICULT_CURVE_WITH_SIGN'

export type RoadTypeCode =
  | 'TOLL_HIGHWAY'
  | 'FREE_HIGHWAY'
  | 'EXPRESS'
  | 'DUAL_CARRIAGEWAY'
  | 'CONVENTIONAL_2X1'
  | 'CONVENTIONAL_ADDITIONAL'
  | 'INTERCHANGE_RAMP'
  | 'CONTRAFLOW'
  | 'AGRICULTURAL'
  | 'SERVICE'
  | 'OTHER'

export type NetworkCategoryCode =
  | 'HIGHWAY'
  | 'NATIONAL'
  | 'REGIONAL'
  | 'LOCAL'
  | 'COMMUNAL'
  | 'UNCLASSIFIED'
  | 'AGRICULTURAL'
  | 'OTHER'

export type TrafficRegimeCode =
  | 'ONE_WAY'
  | 'BIDIRECTIONAL'
  | 'SEPARATED'
  | 'VARIABLE'

export type TrafficDirectionCode =
  | 'INCREASING'
  | 'DECREASING'
  | 'BOTH'
  | 'UNKNOWN'

export type RoadWidthCode =
  | 'GREATER_375'
  | 'FROM_325_TO_375'
  | 'LESS_325'

export type LaneWidthCode =
  | 'LESS_6'
  | 'FROM_6_TO_7'
  | 'GREATER_OR_EQUAL_7'

export type LuminosityCode =
  | 'FULL_DAYLIGHT'
  | 'TWILIGHT_DAWN'
  | 'NIGHT_NO_PUBLIC_LIGHTING'
  | 'NIGHT_LIGHTING_OFF'
  | 'NIGHT_LIGHTING_ON'
  | 'NIGHT_SUFFICIENT_LIGHTING'
  | 'INSUFFICIENT'

export type AtmosphericConditionsCode =
  | 'GOOD_WEATHER'
  | 'LIGHT_RAIN'
  | 'HEAVY_RAIN'
  | 'FOG_SMOKE'
  | 'WIND'
  | 'SNOW'
  | 'OTHER'

export type VisibilityCode =
  | 'CLEAR'
  | 'NOT_CLEAR'
  | 'FOG'
  | 'NIGHT'
  | 'OTHER'

export type RoadPavementCode = 'PAVED' | 'UNPAVED'

export type ParticipantTypeCode =
  | 'DRIVER'
  | 'PASSENGER'
  | 'PEDESTRIAN'
  | 'OWNER'
  | 'WITNESS'
  | 'LEGAL_GUARDIAN'
  | 'ESCORT'
  | 'DISPUTE_RESOLUTION_AGENT'
  | 'COMPANION'

export type VehicleTypeCode =
  | 'BICYCLE'
  | 'MOPED'
  | 'QUAD_50'
  | 'TRICYCLE'
  | 'MOTO_50_125'
  | 'MOTO_125'
  | 'QUAD_50_PLUS'
  | 'VEHICLE_ALONE'
  | 'VEHICLE_TRAILER'
  | 'AGRICULTURAL_MACHINE'
  | 'AGRICULTURAL_TRACTOR_NO_TRAILER'
  | 'AGRICULTURAL_TRACTOR_TRAILER'
  | 'LIGHT_TRUCK_3_5T'
  | 'LIGHT_TRUCK_TRAILER'
  | 'VAN'
  | 'PL_3_5_7_5T'
  | 'PL_7_5T_PLUS'
  | 'PL_TRAILER'
  | 'ROAD_TRACTOR_ALONE'
  | 'ROAD_TRACTOR_SEMI_TRAILER'
  | 'BUS_LINE'
  | 'BUS_OTHER'
  | 'TRAIN'
  | 'LIGHT_METRO'
  | 'TOWED_VEHICLE'
  | 'PUSHED_VEHICLE'
  | 'CART'
  | 'ANIMAL'
  | 'SPECIAL_EQUIPMENT'
  | 'OTHER'
  | 'UNKNOWN'

export type SpecialTypeCode =
  | 'TAXI'
  | 'LOUAGE'
  | 'AMBULANCE'
  | 'FIREFIGHTER'
  | 'POLICE'
  | 'SCHOOL_TRANSPORT'
  | 'DANGEROUS_GOODS'
  | 'ROAD_MAINTENANCE'
  | 'NONE'

export type InsuranceCode = 'YES' | 'NO' | 'NOT_PRESENT'

export type VehiclePositionCode =
  | 'FRONT_LEFT'
  | 'FRONT_RIGHT'
  | 'REAR_LEFT'
  | 'REAR_RIGHT'
  | 'REAR_CENTER'
  | 'OTHER'

export type PedestrianLocationCode =
  | 'CROSSWALK'
  | 'OUTSIDE_CROSSWALK'
  | 'SIDEWALK'
  | 'SHOULDER'
  | 'ROAD'
  | 'OTHER'

export type ActionCode =
  | 'DRIVER_STRAIGHT'
  | 'DRIVER_TURN_LEFT'
  | 'DRIVER_TURN_RIGHT'
  | 'DRIVER_OVERTAKING'
  | 'DRIVER_REVERSING'
  | 'DRIVER_STOPPING'
  | 'DRIVER_PARKING'
  | 'DRIVER_OTHER'
  | 'PEDESTRIAN_CROSSING'
  | 'PEDESTRIAN_WALKING_SAME_DIRECTION'
  | 'PEDESTRIAN_WALKING_OPPOSITE_DIRECTION'
  | 'PEDESTRIAN_STANDING'
  | 'PEDESTRIAN_RUNNING'
  | 'PEDESTRIAN_OTHER'

export type TravelReasonCode =
  | 'HOME_WORK'
  | 'WORK_HOME'
  | 'PROFESSIONAL'
  | 'SCHOOL'
  | 'SHOPPING'
  | 'LEISURE'
  | 'OTHER'

export type PlannedTripCode =
  | 'LESS_5KM'
  | 'FROM_5_TO_25KM'
  | 'FROM_25_TO_50KM'
  | 'FROM_50_TO_100KM'
  | 'MORE_100KM'
  | 'UNKNOWN'

export type SafetyEquipmentCode =
  | 'SEATBELT'
  | 'HELMET'
  | 'CHILD_SEAT'
  | 'NONE'
  | 'UNKNOWN'

export type InjurySeverityCode =
  | 'UNINJURED'
  | 'LIGHT_INJURY'
  | 'SERIOUS_INJURY'
  | 'FATAL'

export type AlcoholTestCode =
  | 'NOT_DONE'
  | 'NEGATIVE'
  | 'POSITIVE'
  | 'REFUSED'

export type DrugTestCode =
  | 'NOT_DONE'
  | 'NEGATIVE'
  | 'POSITIVE'
  | 'REFUSED'

export type InfractionCode =
  | 'NONE'
  | 'SPEEDING'
  | 'RED_LIGHT'
  | 'STOP_SIGN'
  | 'WRONG_WAY'
  | 'NO_LICENSE'
  | 'EXPIRED_LICENSE'
  | 'NO_INSURANCE'
  | 'DUI'
  | 'PHONE_USE'
  | 'OTHER'

export type AccidentCauseCode =
  | 'INATTENTION'
  | 'INAPPROPRIATE_SPEED'
  | 'INFRACTION'
  | 'INEXPERIENCE'
  | 'FATIGUE'
  | 'ALCOHOL_DRUGS'
  | 'ILLNESS'
  | 'ROAD_CONDITION'
  | 'SIGNAGE_CONDITION'
  | 'VEHICLE_CONDITION'
  | 'BREAKDOWN'
  | 'OVERLOAD'
  | 'ADVERSE_WEATHER'
  | 'GLARE'
  | 'ANIMAL'
  | 'OTHER'
  | 'NO_OPINION'

export type AccidentTypeCode =
  | 'COLLISION_MOVING'
  | 'COLLISION_OBSTACLE'
  | 'COLLISION_PEDESTRIAN_ANIMAL'
  | 'ROLLOVER_ON_ROADWAY'
  | 'RUNOFF_LEFT_COLLISION'
  | 'RUNOFF_RIGHT_COLLISION'
  | 'RUNOFF_LEFT_NO_COLLISION'
  | 'RUNOFF_RIGHT_NO_COLLISION'
  | 'OTHER'

export type AccidentSubTypeCode =
  | 'FRONT'
  | 'REAR'
  | 'SIDE'
  | 'FRONT_SIDE'
  | 'CHAIN'
  | 'MULTIPLE'
  | 'PARKED_VEHICLE'
  | 'SAFETY_BARRIER'
  | 'LEVEL_CROSSING_BARRIER'
  | 'SIGNAL_SUPPORT'
  | 'ISLAND_REFUGE'
  | 'OTHER_OBJECT'
  | 'PEDESTRIAN_GROUP'
  | 'PEDESTRIAN_BICYCLE'
  | 'PEDESTRIAN_REPAIR'
  | 'ANIMAL_DRIVER'
  | 'ANIMAL_HERD'
  | 'DOMESTIC_ANIMAL'
  | 'WILD_ANIMAL'
  | 'ROLLOVER_ON_ROADWAY'
  | 'LEFT_TREE'
  | 'LEFT_POLE'
  | 'LEFT_BUILDING'
  | 'LEFT_STREET_FURNITURE'
  | 'LEFT_CURB'
  | 'LEFT_DITCH'
  | 'LEFT_OTHER'
  | 'RIGHT_TREE'
  | 'RIGHT_POLE'
  | 'RIGHT_BUILDING'
  | 'RIGHT_STREET_FURNITURE'
  | 'RIGHT_CURB'
  | 'RIGHT_DITCH'
  | 'RIGHT_OTHER'
  | 'LEFT_FALL'
  | 'LEFT_ROLLOVER'
  | 'LEFT_FLAT'
  | 'LEFT_OTHER_NO_COLLISION'
  | 'RIGHT_FALL'
  | 'RIGHT_ROLLOVER'
  | 'RIGHT_FLAT'
  | 'RIGHT_OTHER_NO_COLLISION'
  | 'PASSENGER_FALL'
  | 'VEHICLE_FIRE'
  | 'COLLISION_TRAIN'
  | 'COLLISION_METRO'
  | 'OTHER'

export type DamageSeverityCode = 'LIGHT' | 'SEVERE'

// ---- Interfaces ----

export interface LocationInfo {
  latitude: number
  longitude: number
  description: string
  roadReference?: string
  kilometerMarker?: string
}

export interface RoadInfo {
  type: RoadTypeCode
  networkCategory: NetworkCategoryCode
  zone: ZoneCode
  urbanity: UrbanityCode
  sinuosity: RoadSinuosityCode
  marking: RoadMarkingCode
  planLayout: PlanLayoutCode
  width: RoadWidthCode
  laneWidth: LaneWidthCode
  pavement: RoadPavementCode
  trafficRegime: TrafficRegimeCode
  trafficDirection: TrafficDirectionCode
}

export interface EnvironmentalConditions {
  luminosity: LuminosityCode
  atmosphericConditions: AtmosphericConditionsCode
  visibility: VisibilityCode
  roadSurfaceCondition?: string
  trafficConditions?: string
  constructionZone?: boolean
  signageVisibility?: string
}

export interface VehicleInfo {
  id?: string
  type: VehicleTypeCode
  specialType: SpecialTypeCode
  insurance: InsuranceCode
  insuranceCompany?: string
  insurancePolicyNumber?: string
  licensePlate?: string
  brand?: string
  model?: string
  year?: number
  position: VehiclePositionCode
  damageSeverity: DamageSeverityCode
  damageDescription?: string
  mechanicalIssues?: string
}

export interface ParticipantInfo {
  id?: string
  type: ParticipantTypeCode
  name?: string
  idNumber?: string
  contactInfo?: string
  licenseNumber?: string
  licenseExpiration?: string
  safetyEquipment: SafetyEquipmentCode
  injurySeverity: InjurySeverityCode
  medicalAttention?: string
  hospitalInfo?: string
  alcoholTest: AlcoholTestCode
  drugTest: DrugTestCode
  infraction: InfractionCode
  action: ActionCode
  travelReason: TravelReasonCode
  plannedTrip: PlannedTripCode
}

export interface AccidentDetails {
  type: AccidentTypeCode
  subType: AccidentSubTypeCode
  causes: AccidentCauseCode[]
  contributingFactors?: string[]
  description: string
  witnessInfo?: string
  policeReportNumber?: string
  respondingOfficer?: string
  investigationStatus?: string
  casePriority?: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface EvidenceInfo {
  photos: EvidenceFile[]
  sketch?: EvidenceFile
  sketchData?: string // JSON string for sketch
  autoSaveDraft?: boolean
}

export interface EvidenceFile {
  id?: string
  type: AttachmentTypeCode
  url: string
  description?: string
  uploadStatus: UploadStatusCode
  createdAt?: string
}

export interface AccidentReport {
  id?: string
  location: LocationInfo
  time: string // ISO date string
  dayType: DayTypeCode
  situation: AccidentSituationCode
  road: RoadInfo
  environmental: EnvironmentalConditions
  vehicles: VehicleInfo[]
  participants: ParticipantInfo[]
  details: AccidentDetails
  evidence: EvidenceInfo
  createdAt?: string
  updatedAt?: string
  createdBy?: string
}

// ---- Form State Interfaces ----

export interface AccidentFormState {
  // Basic Information
  location: LocationInfo
  time: string
  dayType: DayTypeCode
  situation: AccidentSituationCode
  
  // Road Information
  road: RoadInfo
  
  // Environmental Conditions
  environmental: EnvironmentalConditions
  
  // Vehicles (can be multiple)
  vehicles: VehicleInfo[]
  
  // Participants (can be multiple)
  participants: ParticipantInfo[]
  
  // Accident Details
  details: AccidentDetails
  
  // Evidence
  evidence: EvidenceInfo
  
  // Form State
  isSubmitting: boolean
  errors: Record<string, string>
}

// ---- API Response Interfaces ----

export interface CreateAccidentResponse {
  success: boolean
  data: AccidentReport
  message?: string
}

export interface AccidentValidationError {
  field: string
  message: string
  code?: string
}

export interface CreateAccidentErrorResponse {
  success: boolean
  errors: AccidentValidationError[]
  message: string
}