import { Card, CardContent, Typography, Chip, Box } from "@mui/material";

export default function BookCard({ book }) {
  if (!book) return null; // defensive guard — same insurance as DatabaseCard

  return (
    <Card sx={{ mb: 2, borderRadius: 3, boxShadow: 3 }}>
      <CardContent>
        <Typography variant="h6" fontWeight="bold">
          {book.title}
        </Typography>

        <Typography variant="body2" color="text.secondary">
          {book.main_author}
        </Typography>

        <Box mt={1}>
          {book.subjects?.slice(0, 3).map((sub, i) => (
            <Chip key={i} label={sub} size="small" sx={{ mr: 1 }} />
          ))}
        </Box>

        {book.call_number && (
          <Typography mt={2} variant="body2">
            📍 <b>Call Number:</b> {book.call_number}
          </Typography>
        )}

        {book.navigation && (
          <Typography mt={1} variant="body2" color="primary">
            🧭 {book.navigation}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

// import { Card, CardContent, Typography, Chip, Box } from "@mui/material";
// import PublicIcon from "@mui/icons-material/Public";
// import LockIcon from "@mui/icons-material/Lock";

// export default function DatabaseCard({ database }) {
//   return (
//     <Card sx={{ mb: 2, borderRadius: 3, boxShadow: 3 }}>
//       <CardContent>
//         <Box display="flex" alignItems="center" gap={1}>
//           <PublicIcon fontSize="small" sx={{ color: "#C9A84C" }} />
//           <Typography
//             component="a"
//             href={database.url}
//             target="_blank"
//             rel="noopener noreferrer"
//             variant="h6"
//             fontWeight="bold"
//             sx={{ color: "#0B1F3A", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
//           >
//             {database.name}
//           </Typography>
//         </Box>

//         {database.description && (
//           <Typography variant="body2" color="text.secondary" mt={0.5}>
//             {database.description}
//           </Typography>
//         )}

//         {database.accessNote && (
//           <Box display="flex" alignItems="center" gap={0.5} mt={1}>
//             <LockIcon sx={{ fontSize: 14, color: "#b8860b" }} />
//             <Typography variant="caption" sx={{ color: "#b8860b", fontWeight: 600 }}>
//               {database.accessNote}
//             </Typography>
//           </Box>
//         )}

//         {database.faculties?.length > 0 && (
//           <Box mt={1}>
//             {database.faculties.slice(0, 3).map((f, i) => (
//               <Chip key={i} label={f} size="small" sx={{ mr: 1, mt: 0.5 }} />
//             ))}
//           </Box>
//         )}
//       </CardContent>
//     </Card>
//   );
// }


// import { Card, CardContent, Typography, Chip, Box } from "@mui/material";
// import NavigationGuide from "./NavigationGuide";


// export default function BookCard({ book }) {
//   return (
//     <Card sx={{ mb: 2, borderRadius: 3, boxShadow: 3 }}>
//       <CardContent>
//         <Typography variant="h6" fontWeight="bold">
//           {book.title}
//         </Typography>

//         <Typography variant="body2" color="text.secondary">
//           {book.main_author}
//         </Typography>

//         <Box mt={1}>
//           {book.subjects?.slice(0, 3).map((sub, i) => (
//             <Chip key={i} label={sub} size="small" sx={{ mr: 1 }} />
//           ))}
//         </Box>

//         {/* Call Number */}
//         {book.call_number && (
//           <Typography mt={2} variant="body2">
//             📍 <b>Call Number:</b> {book.call_number}
//           </Typography>
//         )}

//          {/* 🔥 NEW NAVIGATION UI */}
//          {/* <NavigationGuide callNumber={book.call_number} /> */}

//         {/* Navigation */}
//         {book.navigation && (
//           <Typography mt={1} variant="body2" color="primary">
//             🧭 {book.navigation}
//           </Typography>
//         )}
//       </CardContent>
//     </Card>
//   );
// }