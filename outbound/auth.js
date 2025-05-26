// Tampilkan Team & PIC jika Position = OPERATOR
const positionSelect = document.getElementById("position");
const operatorFields = document.getElementById("operatorFields");
const usernameContainer = document.getElementById("usernameContainer");
const usernameInput = document.getElementById("username");

// Loading & Error Elements
const loginBtn = document.getElementById("loginBtn");
const loginBtnText = document.getElementById("loginBtnText");
const loginLoader = document.getElementById("loginLoader");
const errorMsg = document.getElementById("errorMsg");

positionSelect.addEventListener("change", () => {
  if (positionSelect.value === "Operator") {
    operatorFields.style.display = "block";
    usernameContainer.style.display = "none";
    usernameInput.required = false;
  } else {
    operatorFields.style.display = "none";
    usernameContainer.style.display = "block";
    usernameInput.required = true;
  }
});

document.getElementById("loginForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  // Tampilkan loading spinner
  loginBtn.disabled = true;
  loginBtnText.style.display = "none";
  loginLoader.style.display = "inline-block";
  errorMsg.style.display = "none";

  try {
    const shift = document.getElementById("shift").value;
    const position = document.getElementById("position").value;
    const username =
      position === "OPERATOR"
        ? document.getElementById("picInput").value.trim()
        : document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    // Simulasi password untuk setiap posisi
    const positionPasswords = {
      "Operator": "operator123",
      "Team Leader": "leader123",
      "SPV": "spv123",
      "Asst. Manager": "asstman123",
      "Manager": "manager123"
    };

    // Simulasi proses autentikasi (delay 1s)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (positionPasswords[position] && password === positionPasswords[position]) {
      localStorage.setItem("shift", shift);
      localStorage.setItem("position", position);

      if (position === "Operator") {
        const team = document.getElementById("teamSelect").value;
        const pic = document.getElementById("picInput").value.trim();

        if (!team || !pic) {
          throw new Error("Lengkapi pilihan Team dan PIC terlebih dahulu.");
        }

        localStorage.setItem("team", team);
        localStorage.setItem("pic", pic);
        localStorage.setItem("username", pic); // PIC sebagai username

        // Redirect ke halaman berdasarkan team
        if (team === "Sugity") {
          window.location.href = "monitoring-control/team-sugity.html";
        } else if (team === "Reguler") {
          window.location.href = "monitoring-control/team-reguler.html";
        } else {
          throw new Error("Team tidak valid.");
        }

      } else {
        // Simpan info user non-operator
        localStorage.setItem("username", username);

        // Redirect semua posisi non-operator ke halaman sort-job
        window.location.href = "monitoring-control/sort-job.html";
      }

    } else {
      throw new Error("Username atau password salah!");
    }
  } catch (err) {
    // Tampilkan error message
    errorMsg.textContent = err.message || "Terjadi kesalahan saat login.";
    errorMsg.style.display = "block";
  } finally {
    // Sembunyikan loading, aktifkan tombol lagi
    loginBtn.disabled = false;
    loginBtnText.style.display = "inline";
    loginLoader.style.display = "none";
  }
});
