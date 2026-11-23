// utils/academicCatalog.js
// Single source of truth for departments, library-of-congress (LC) classes,
// and starter topics. VERIFY the department list against UNIJOS's real faculties;
// adding a department is one line. `lc` = call-number prefixes used to find that
// department's books (e.g. "K" = law, "RS" = pharmacy). `topics` are only shown
// as suggestions if the catalogue actually contains matching books.

const NB   = "Bauchi Road Campus Library";
const NG   = "Naraguta Campus Library";
const LAW  = "Faculty of Law Library";
const JUTH = "JUTH Library";

const d = (name, faculty, campus, lc, topics) => ({ name, faculty, campus, lc, topics });

export const DEPARTMENTS = [
  // Law
  d("Law", "Law", LAW, ["K"], ["constitutional law", "criminal law", "contract", "company law", "evidence", "labour law"]),
  // Pharmaceutical Sciences
  d("Pharmacy", "Pharmaceutical Sciences", NB, ["RS", "RM", "QD"], ["pharmacology", "pharmacognosy", "medicinal chemistry", "pharmaceutics", "drug delivery"]),
  // Dental Sciences
  d("Dentistry", "Dental Sciences", NB, ["RK"], ["dentistry", "periodontal", "oral surgery", "dental"]),
  // Medical Sciences
  d("Medicine & Surgery", "Medical Sciences", `${NB} and ${JUTH}`, ["R", "QM", "QP"], ["clinical medicine", "surgery", "neurology", "dermatology", "ophthalmology"]),
  d("Anatomy", "Medical Sciences", NB, ["QM", "QP"], ["anatomy", "physiology", "histology", "neuroanatomy"]),
  d("Physiology", "Medical Sciences", NB, ["QP"], ["physiology", "biochemistry", "pharmacology"]),
  // Health Sciences
  d("Nursing", "Health Sciences", NB, ["RT", "RA", "RC"], ["nursing", "public health", "pharmacology", "clinical"]),
  d("Medical Laboratory Science", "Health Sciences", NB, ["RB", "QR", "QP"], ["haematology", "clinical chemistry", "microbiology", "parasitology", "immunology"]),
  d("Radiography", "Health Sciences", NB, ["RC78", "R8"], ["radiography", "ultrasound", "imaging"]),
  // Natural Sciences
  d("Mathematics", "Natural Sciences", NB, ["QA"], ["analysis", "algebra", "topology", "differential equations", "complex analysis"]),
  d("Statistics", "Natural Sciences", NB, ["QA", "HA"], ["statistics", "probability", "regression", "biostatistics"]),
  d("Physics", "Natural Sciences", NB, ["QC"], ["quantum mechanics", "thermodynamics", "electromagnetism", "solid state physics", "relativity"]),
  d("Chemistry", "Natural Sciences", NB, ["QD"], ["organic chemistry", "physical chemistry", "analytical chemistry", "inorganic chemistry"]),
  d("Biochemistry", "Natural Sciences", NB, ["QP", "QD"], ["biochemistry", "enzyme", "molecular biology", "genetics"]),
  d("Microbiology", "Natural Sciences", NB, ["QR"], ["microbiology", "immunology", "parasitology", "virology"]),
  d("Plant Science & Biotechnology", "Natural Sciences", NB, ["QK", "QH", "TP"], ["botany", "biotechnology", "genetics", "plant"]),
  d("Zoology", "Natural Sciences", NB, ["QL", "QH"], ["zoology", "ecology", "genetics"]),
  d("Geology", "Natural Sciences", NB, ["QE", "TN"], ["geology", "geophysics", "petrology", "hydrology"]),
d("Computer Science", "Natural Sciences", NB,
  ["QA76", "QA75", "TK5105", "TK5101", "TK7885", "TK7895", "Q335", "Q325"],
  ["programming", "computer", "algorithms", "database", "networking"]),
  
  // Engineering
  d("Civil Engineering", "Engineering", NG, ["TA", "TH", "TC", "TD"], ["reinforced concrete", "surveying", "hydrology", "soil mechanics", "structural analysis"]),
  d("Electrical & Electronics Engineering", "Engineering", NG, ["TK"], ["electronics", "circuits", "power systems", "microprocessor", "signal processing"]),
  d("Mechanical Engineering", "Engineering", NG, ["TJ", "TA"], ["mechanics", "thermodynamics", "heat transfer", "manufacturing"]),
  d("Chemical Engineering", "Engineering", NG, ["TP"], ["chemical engineering", "process", "thermodynamics", "petroleum"]),
  // Environmental Sciences
  d("Architecture", "Environmental Sciences", NG, ["NA", "TH"], ["architecture", "building", "design"]),
  d("Estate Management", "Environmental Sciences", NG, ["HD", "TH", "KN"], ["valuation", "estimating", "real estate", "building"]),
  d("Quantity Surveying", "Environmental Sciences", NG, ["TH", "TA"], ["quantity surveying", "estimating", "building", "construction"]),
  d("Surveying & Geoinformatics", "Environmental Sciences", NG, ["TA", "G"], ["surveying", "gps", "remote sensing", "mapping"]),
  d("Urban & Regional Planning", "Environmental Sciences", NG, ["HT", "NA"], ["planning", "urban", "environmental"]),
  d("Geography", "Environmental Sciences", NG, ["G"], ["geography", "climate", "environment"]),
  // Agricultural Sciences
  d("Agronomy & Crop Science", "Agricultural Sciences", NG, ["S", "SB"], ["agronomy", "crop", "soil", "farm"]),
  d("Animal Science", "Agricultural Sciences", NG, ["SF"], ["poultry", "animal nutrition", "livestock", "dairy"]),
  d("Fisheries", "Agricultural Sciences", NG, ["SH"], ["fish", "aquaculture", "fisheries"]),
  // Veterinary Medicine
  d("Veterinary Medicine", "Veterinary Medicine", NG, ["SF"], ["veterinary", "anatomy", "pathology", "parasitology"]),
  // Management Sciences
  d("Accounting", "Management Sciences", NG, ["HF", "HG", "HJ", "KN"], ["accounting", "taxation", "cost", "auditing", "financial"]),
  d("Business Administration", "Management Sciences", NG, ["HD", "HF"], ["management", "marketing", "business", "entrepreneurship"]),
  d("Banking & Finance", "Management Sciences", NG, ["HG", "KN"], ["banking", "finance", "insurance"]),
  // Social Sciences
  d("Economics", "Social Sciences", NG, ["HB", "HC", "HD"], ["economics", "development", "macroeconomic", "statistics"]),
  d("Sociology", "Social Sciences", NG, ["HM", "HN", "HQ"], ["sociology", "society", "gender", "culture"]),
  d("Political Science", "Social Sciences", NG, ["J"], ["politics", "democracy", "government", "international"]),
  d("Psychology", "Social Sciences", NG, ["BF", "RC"], ["psychology", "counselling", "behaviour"]),
  d("Mass Communication", "Social Sciences", NG, ["P", "PN"], ["communication", "media", "journalism"]),
  // Arts
  d("English", "Arts", NG, ["P", "PE", "PR"], ["english", "literature", "grammar"]),
  d("History", "Arts", NG, ["D", "DT"], ["history", "nigeria", "africa"]),
  d("Religious Studies", "Arts", NG, ["B"], ["christianity", "islam", "religion"]),
  // Education
 
// Education
d(
  "Arts Education",
  "Education",
  `${NB} and ${NG}`,
  ["L"],
  ["arts education", "language education", "literature education", "teaching of arts", "arts curriculum"]
),

d(
  "Educational Foundation",
  "Education",
  `${NB} and ${NG}`,
  ["L"],
  ["educational foundations", "philosophy of education", "history of education", "sociology of education", "educational psychology"]
),

d(
  "Physical and Health Education",
  "Education",
  `${NB} and ${NG}`,
  ["L", "GV"],
  ["physical education", "health education", "sports education", "sports science", "physical fitness"]
),

d(
  "Science and Technology Education",
  "Education",
  `${NB} and ${NG}`,
  ["L", "Q"],
  ["science education", "technology education", "science teaching", "educational technology", "science curriculum"]
),

d(
  "Social Science Education",
  "Education",
  `${NB} and ${NG}`,
  ["L"],
  ["social science education", "social studies education", "civic education", "geography education", "economics education"]
),

d(
  "Special Education and Rehabilitation Sciences",
  "Education",
  `${NB} and ${NG}`,
  ["L"],
  ["special education", "inclusive education", "rehabilitation", "learning disabilities", "disability studies"]
),

d(
  "Library and Information Science",
  "Education",
  `${NB} and ${NG}`,
  ["Z"],
  ["library science", "information science", "library management", "cataloguing", "classification", "information management"]
),

// Legacy entries — retain these to support existing student profiles
d(
  "Education",
  "Education",
  `${NB} and ${NG}`,
  ["L"],
  ["teaching", "curriculum", "educational", "counselling"]
),

d(
  "Science Education",
  "Education",
  `${NB} and ${NG}`,
  ["Q", "L"],
  ["science education", "teaching of science", "curriculum"]
),

  // Fallback
  d("Other / Not listed", "Other", null, [], []),
];

export const LEVELS = ["100", "200", "300", "400", "500", "600", "Postgraduate Diploma", "Masters", "PhD", "Staff / Not applicable"];

export const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu",
  "FCT (Abuja)","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo",
  "Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara","Non-Nigerian",
];

export const findDepartment = (name) =>
  name ? DEPARTMENTS.find((x) => x.name.toLowerCase() === String(name).toLowerCase()) || null : null;
