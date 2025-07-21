# 📊 AssetTracker

A full-stack web application that helps users track daily usage and cost of their personal assets (e.g., electronics, furniture, etc.). Users can add, edit, and delete assets while viewing insights like average daily cost and visual analysis via pie charts.

![screenshot](./assets/demo.png)

---

## 🔧 Tech Stack

**Frontend:**  
- React + Vite  
- Tailwind CSS (Custom + Responsive Utilities)  
- Axios for API communication  

**Backend:**  
- Node.js + Express  
- MongoDB + Mongoose  
- Winston & Morgan (logging), express-validator, rate-limit

**DevOps & Deployment:**  
- GitHub Actions CI/CD (auto deploy on push)  
- AWS EC2 (backend), DuckDNS + Nginx (HTTPS via Certbot)  
- Vercel (previous frontend deployment, now fully on AWS)

---

## 🚀 Features

- ✅ Add/edit/delete assets
- 📅 Track usage duration and average daily cost
- 📈 Sort by cost, visualize with pie charts
- 🧮 Auto-calculate `daysUsed` and `dailyCost` on backend
- 👤 Optional user system (multi-user support by `userId`)
- 📤 Export to CSV/JSON
- 🌐 Fully deployed backend with HTTPS (Nginx + Certbot)
- ✅ Custom error handling, form validation, rate limiting
- ✨ Modern UI using Tailwind and dark mode support

---
