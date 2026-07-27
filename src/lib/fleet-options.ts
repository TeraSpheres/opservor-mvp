/* Fleet reference data.
 *
 * These were free-text inputs, which meant "Cargo Van", "cargo van" and
 * "CargoVan" were three different vehicle types and nothing could be grouped
 * or reported on. They are grouped selects now.
 *
 * The lists are deliberately broad — a fleet is whatever the operator runs,
 * and that ranges from cargo bikes to tower cranes to rail shunters. Groups
 * keep a long list usable.
 *
 * Every list ends with "Other" so an operator is never blocked by a gap.
 * Values are stored as written, so adding an entry here does not require a
 * migration; the column is text.
 */

export interface OptionGroup {
  label: string;
  options: string[];
}

export const VEHICLE_TYPE_GROUPS: OptionGroup[] = [
  {
    label: "Light commercial",
    options: [
      "Car", "Estate / Wagon", "SUV", "Pickup truck", "Panel van", "Crew van",
      "Box van / Luton", "Dropside van", "Refrigerated van", "Minibus",
      "Curtain-side van",
    ],
  },
  {
    label: "Heavy goods",
    options: [
      "Rigid truck (2-axle)", "Rigid truck (3-axle)", "Rigid truck (4-axle)",
      "Tractor unit", "Curtain-side trailer", "Box trailer", "Flatbed trailer",
      "Refrigerated trailer", "Tipper / Dump truck", "Tanker (liquid)",
      "Tanker (powder)", "Car transporter", "Concrete mixer", "Concrete pump",
      "Skip loader", "Hook loader", "Livestock carrier", "Logging truck",
      "Low-loader / Heavy haulage", "Container skeletal",
    ],
  },
  {
    label: "Passenger transport",
    options: [
      "Coach", "Bus (single deck)", "Bus (double deck)", "Articulated bus",
      "Shuttle bus", "Taxi / Private hire", "Ambulance", "Patient transport",
    ],
  },
  {
    label: "Material handling",
    options: [
      "Forklift (counterbalance)", "Forklift (rough terrain)", "Reach truck",
      "Powered pallet truck", "Order picker", "Stacker", "Telehandler",
      "Tow tractor / Tugger", "Side loader", "Straddle carrier",
      "Reach stacker", "AGV / AMR",
    ],
  },
  {
    label: "Plant and construction",
    options: [
      "Excavator (tracked)", "Excavator (wheeled)", "Mini excavator",
      "Backhoe loader", "Wheel loader", "Skid-steer loader", "Bulldozer",
      "Motor grader", "Roller / Compactor", "Mobile crane", "Tower crane",
      "Crawler crane", "Site dumper", "Trencher", "Scissor lift", "Boom lift",
      "Piling rig", "Asphalt paver",
    ],
  },
  {
    label: "Agricultural",
    options: [
      "Tractor", "Combine harvester", "Forage harvester", "Sprayer", "Baler",
      "Seed drill", "Agricultural trailer", "Slurry tanker", "Telehandler (agri)",
    ],
  },
  {
    label: "Specialist and municipal",
    options: [
      "Street sweeper", "Refuse collection vehicle", "Gritter / Salt spreader",
      "Snow plough", "Fire appliance", "Recovery / Tow truck", "Mobile workshop",
      "Water bowser", "Fuel bowser", "Vacuum tanker", "Jetting unit",
      "Mobile crane (rail)", "Utility / Cherry picker", "Road sweeper (compact)",
    ],
  },
  {
    label: "Rail, marine and air-side",
    options: [
      "Shunter locomotive", "Rail wagon", "Rail maintenance vehicle",
      "Barge", "Tug", "Workboat", "Pilot vessel",
      "Aircraft tug", "Baggage tractor", "Belt loader", "Catering truck",
      "De-icing vehicle", "Refuelling bowser (aviation)",
    ],
  },
  {
    label: "Two and three wheel",
    options: [
      "Motorcycle", "Scooter", "Delivery moped", "Cargo e-bike",
      "Cargo trike", "Quad / ATV", "UTV / Side-by-side",
    ],
  },
  {
    label: "Trailers and non-powered",
    options: [
      "Drawbar trailer", "Dolly", "Container chassis", "Swap body",
      "Plant trailer", "Mobile generator", "Mobile compressor",
      "Welfare unit", "Site cabin (mobile)",
    ],
  },
  { label: "Other", options: ["Other"] },
];

export const FUEL_TYPE_GROUPS: OptionGroup[] = [
  {
    label: "Liquid fossil",
    options: ["Diesel", "Petrol / Gasoline", "Kerosene", "Heavy fuel oil"],
  },
  {
    label: "Renewable liquid",
    options: [
      "Biodiesel (B20)", "Biodiesel (B100)", "HVO / Renewable diesel",
      "Ethanol (E85)", "Methanol",
    ],
  },
  {
    label: "Gas",
    options: ["CNG", "LNG", "LPG / Propane", "Biomethane"],
  },
  {
    label: "Electric and hybrid",
    options: [
      "Battery electric", "Hybrid (petrol)", "Hybrid (diesel)",
      "Plug-in hybrid", "Range extender", "Hydrogen fuel cell",
      "Hydrogen combustion",
    ],
  },
  {
    label: "Other",
    options: ["Solar assisted", "Non-powered", "Other"],
  },
];

export const MAINTENANCE_TYPE_GROUPS: OptionGroup[] = [
  {
    label: "Scheduled service",
    options: [
      "Routine service", "A-service", "B-service", "C-service",
      "Oil and filter change", "Annual service", "Pre-delivery inspection",
      "Warranty service", "Manufacturer recall",
    ],
  },
  {
    label: "Inspection and compliance",
    options: [
      "Safety inspection", "Roadworthiness test", "Emissions test",
      "Tachograph calibration", "Lifting equipment inspection (LOLER)",
      "Pressure vessel inspection", "Weighbridge calibration",
      "Refrigeration unit inspection", "Tail lift inspection",
      "Fire suppression check",
    ],
  },
  {
    label: "Wear items",
    options: [
      "Tyres — rotation", "Tyres — replacement", "Tyres — puncture repair",
      "Brakes — pads / shoes", "Brakes — discs / drums", "Clutch",
      "Battery replacement", "Wiper blades", "Belts and hoses",
      "Air filter", "Fuel filter", "Cabin filter", "Bulbs and lamps",
    ],
  },
  {
    label: "Fluids",
    options: [
      "Engine oil", "Transmission fluid", "Differential oil", "Coolant",
      "Brake fluid", "Power steering fluid", "Hydraulic fluid",
      "DEF / AdBlue", "Grease and lubrication",
    ],
  },
  {
    label: "Repairs",
    options: [
      "Engine repair", "Transmission repair", "Electrical fault",
      "Bodywork", "Glass / windscreen", "Suspension", "Steering",
      "Exhaust / aftertreatment", "DPF regeneration", "Turbocharger",
      "HVAC / climate", "Refrigeration unit", "Tail lift", "Crane / hiab",
      "Hydraulics", "Pneumatics", "Chassis / welding", "Accident repair",
    ],
  },
  {
    label: "Electric vehicle",
    options: [
      "Battery health check", "Battery replacement (traction)",
      "Charging system", "Thermal management", "Inverter / motor",
      "High-voltage cabling",
    ],
  },
  {
    label: "Fitting and other",
    options: [
      "Telematics installation", "Camera / dashcam installation",
      "Livery and signage", "Deep clean", "Valeting", "Winter preparation",
      "Storage / lay-up", "Decommissioning", "Other",
    ],
  },
];

export const MAINTENANCE_STATUSES = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_PRIORITIES = ["routine", "high", "critical"] as const;
export type MaintenancePriority = (typeof MAINTENANCE_PRIORITIES)[number];

/** Total option count, used in the UI so the breadth is visible. */
export const optionCount = (groups: OptionGroup[]) =>
  groups.reduce((n, g) => n + g.options.length, 0);
