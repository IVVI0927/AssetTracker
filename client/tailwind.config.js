// tailwind.config.js
// This is the Tailwind CSS configuration file for the project.
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')], // ⬅️ 添加这一行
}
