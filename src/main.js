import { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, doc, setDoc, getDoc, adminWhitelist } from './firebase.js';

window.appData = {};

let syncTimeout = null;
const syncToFirebase = (force = false) => {
    return new Promise((resolve) => {
        if (syncTimeout) clearTimeout(syncTimeout);
        const executeSync = async () => {
            try {
                const cleanData = {};
                for (let k in window.appData) {
                    if (window.appData[k] !== undefined) {
                        cleanData[k] = window.appData[k];
                    }
                }
                await setDoc(doc(db, 'portfolio', 'data'), cleanData);
                console.log("Firebase sync success");
                resolve(true);
            } catch(e) {
                console.error("Firebase sync error:", e);
                resolve(false);
            }
        };
        if (force) {
            executeSync();
        } else {
            syncTimeout = setTimeout(executeSync, 1500);
        }
    });
};

const appStore = {
    getItem: (key) => {
        if (key === 'portfolio_language') return localStorage.getItem(key);
        if (window.appData && window.appData[key] !== undefined) return window.appData[key];
        return null;
    },
    setItem: (key, val) => {
        if (key === 'portfolio_language') {
            localStorage.setItem(key, val);
            return;
        }
        if(!window.appData) window.appData = {};
        window.appData[key] = val;
        syncToFirebase();
    },
    removeItem: (key) => {
        if (key === 'portfolio_language') {
            localStorage.removeItem(key);
            return;
        }
        if(window.appData) delete window.appData[key];
        syncToFirebase();
    }
};

// Navigation and Scroll handling
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const docSnap = await getDoc(doc(db, 'portfolio', 'data'));
        if (docSnap.exists()) {
            window.appData = docSnap.data();
        } else {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if(key !== 'portfolio_language') window.appData[key] = localStorage.getItem(key);
            }
            if(Object.keys(window.appData).length > 0) syncToFirebase();
        }
    } catch(e) { console.error('Error loading firebase', e); }

    const sections = document.querySelectorAll('section, #timeline');
    const navLinks = document.querySelectorAll('.nav-links a');
    const navbar = document.querySelector('.navbar');

    // Premium Scroll Reveal using IntersectionObserver
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active-reveal');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const observeElements = () => {
        const revealElements = document.querySelectorAll('.scroll-reveal');
        revealElements.forEach(el => revealObserver.observe(el));
    };

    observeElements();

    // Sticky Navbar & Active Highlights scroll handler
    window.addEventListener('scroll', () => {
        // Sticky navbar effect
        if (window.scrollY > 50) {
            navbar.style.padding = '1rem 0';
            navbar.style.background = '#121e31';
            navbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        } else {
            navbar.style.padding = '1.5rem 0';
            navbar.style.background = 'transparent';
            navbar.style.boxShadow = 'none';
        }

        // Active link highlighting
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (window.pageYOffset >= (sectionTop - 200)) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').includes(current)) {
                link.classList.add('active');
            }
        });
    });

    // Smooth scroll for all anchor links
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = link.getAttribute('href');
            if (targetId === '#') return;
            
            // If clicking timeline link, ensure the timeline tab is activated
            if (targetId === '#timeline') {
                const timelineTabBtn = document.querySelector('.tab-btn[data-tab="timeline-tab"]');
                if (timelineTabBtn) {
                    timelineTabBtn.click();
                }
            }
            
            const targetSection = document.querySelector(targetId);
            if (targetSection) {
                e.preventDefault();
                window.scrollTo({
                    top: targetSection.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Initial reveal elements are observed automatically on load via observeElements()

    // Mobile menu logic (simplified for placeholder)
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu) {
        mobileMenu.addEventListener('click', () => {
            const navLinksContainer = document.querySelector('.nav-links');
            navLinksContainer.classList.toggle('mobile-active');
            if (navLinksContainer.classList.contains('mobile-active')) {
                navLinksContainer.style.display = 'flex';
                navLinksContainer.style.flexDirection = 'column';
                navLinksContainer.style.position = 'absolute';
                navLinksContainer.style.top = '70px';
                navLinksContainer.style.left = '0';
                navLinksContainer.style.width = '100%';
                navLinksContainer.style.background = 'rgba(5, 5, 5, 0.98)';
                navLinksContainer.style.padding = '2rem';
                navLinksContainer.style.borderBottom = '1px solid var(--glass-border)';
            } else {
                navLinksContainer.style.display = '';
            }
        });
    }

    // --- ADMIN SYSTEM & ROLE MANAGEMENT ---
    const adminTrigger = document.getElementById('admin-trigger');
    const adminModal = document.getElementById('admin-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const loginForm = document.getElementById('admin-login-form');
    const passwordInput = document.getElementById('admin-password');
    const loginError = document.getElementById('login-error');
    
    const adminControlBar = document.getElementById('admin-control-bar');
    const saveBtn = document.getElementById('admin-save-btn');
    const cancelBtn = document.getElementById('admin-cancel-btn');
    const logoutBtn = document.getElementById('admin-logout-btn');
    
    const editableAvatar = document.getElementById('editable-avatar');
    const avatarInput = document.getElementById('avatar-input');
    const avatarWrapper = document.querySelector('.avatar-wrapper');
    const editableTags = document.getElementById('editable-tags');
    const editableName = document.getElementById('editable-name');
    const editableDescription = document.getElementById('editable-description');
    
    // About Me & Journey & Experience elements
    const editableJourneySubtitle = document.getElementById('editable-journey-subtitle');
    const editableAboutTopDesc = document.getElementById('editable-about-top-desc');
    const editableAboutImg = document.getElementById('editable-about-img');
    const aboutAvatarWrapper = document.getElementById('about-avatar-wrapper');
    const editableJourneyInfo = document.getElementById('editable-journey-info');
    const editableJourneyText = document.getElementById('editable-journey-text');
    const editableExperienceGrid = document.getElementById('editable-experience-grid');
    const editableTimelineTitle = document.getElementById('editable-timeline-title');
    const editableTimelineContainer = document.getElementById('editable-timeline-container');
    
    // Contact Section editable elements
    const editableContactTitle = document.getElementById('editable-contact-title');
    const editableContactDesc = document.getElementById('editable-contact-desc');
    const editableContactLeftTitle = document.getElementById('editable-contact-left-title');
    const editableContactLocation = document.getElementById('editable-contact-location');
    const editableContactAvail = document.getElementById('editable-contact-avail');
    const editableContactRightTitle = document.getElementById('editable-contact-right-title');
    const editablePartnersTitle = document.getElementById('editable-partners-title');
    const editablePresentasiNum = document.getElementById('editable-presentasi-num');
    const editablePesertaNum = document.getElementById('editable-peserta-num');
    const cardPhotoTesti = document.getElementById('card-photo-testi');
    // Contact Messages Elements
    const adminMessagesBtn = document.getElementById('admin-messages-btn');
    const adminMessagesModal = document.getElementById('admin-messages-modal');
    const closeMessagesModalBtn = document.getElementById('close-messages-modal');
    const msgSearchInput = document.getElementById('msg-search-input');
    const msgListContainer = document.getElementById('msg-list-container');
    const msgDetailPlaceholder = document.getElementById('msg-detail-placeholder');
    const msgDetailView = document.getElementById('msg-detail-view');
    const detailSenderAvatar = document.getElementById('detail-sender-avatar');
    const detailSenderName = document.getElementById('detail-sender-name');
    const detailSenderEmail = document.getElementById('detail-sender-email');
    const detailMsgDate = document.getElementById('detail-msg-date');
    const detailMsgTopic = document.getElementById('detail-msg-topic');
    const detailMsgText = document.getElementById('detail-msg-text');
    const msgToggleUnreadBtn = document.getElementById('msg-toggle-unread-btn');
    const msgDeleteBtn = document.getElementById('msg-delete-btn');
    
    let activeMessageId = null;
    let activePartnerLogoImg = null;
    
    let isAdminActive = false;
    let tempBackup = {};
    let currentAvatarTarget = 'hero'; // 'hero' or 'about'
    // --- MULTI-LANGUAGE (i18n) DICTIONARY ---
    const translations = {
        id: {
            nav_home: "Beranda",
            nav_about: "Tentang Saya",
            nav_timeline: "Linimasa",
            nav_experience: "Pengalaman",
            nav_portfolio: "Portofolio",
            nav_contact: "Kontak",
            hero_btn_portfolio: "Lihat Portofolio",
            hero_btn_contact: "Hubungi Saya",
            about_title: "Tentang <span>Saya</span>",
            about_journey_title: "Perjalanan saya",
            about_tab_career: "🏢 Riwayat Karir",
            about_tab_highlights: "🏆 Sorotan Perjalanan",
            admin_add_timeline: "➕ Tambah Perjalanan Karir",
            portfolio_title: "Portofolio",
            portfolio_filter_all: "Semua Pekerjaan",
            portfolio_filter_web: "Aplikasi Web",
            portfolio_filter_design: "Desain UI/UX",
            contact_title: "Dapat <span>Dihubungi</span>",
            contact_left_title: "Cara tercepat menghubungi saya",
            contact_btn_linkedin: "Kirim pesan di LinkedIn",
            contact_linkedin_caption: "Biasanya dibalas dalam waktu satu hari kerja.",
            contact_label_location: "Lokasi",
            contact_label_avail: "Ketersediaan",
            contact_elsewhere_label: "Temukan saya di media sosial lain",
            contact_right_title: "Kirim pesan",
            contact_card_subtitle: "Tuliskan catatan singkat tentang acara, tim, atau proyek Anda.",
            contact_right_title: "Kirim pesan",
            contact_card_subtitle: "Tuliskan catatan singkat tentang acara, tim, atau proyek Anda.",
            contact_form_name: "Nama",
            contact_ph_name: "Nama Anda",
            contact_form_email: "Email",
            contact_ph_email: "email.anda@example.com",
            contact_form_topic: "Topik",
            topic_ph_select: "Pilih topik...",
            topic_opt_collab: "Kolaborasi / Proyek",
            topic_opt_job: "Peluang Kerja",
            topic_opt_speaking: "Undangan Pembicara / Lokakarya",
            topic_opt_chat: "Hanya ingin menyapa!",
            contact_form_message: "Pesan",
            contact_ph_message: "Tuliskan beberapa kalimat tentang acara, tim, atau proyek Anda.",
            contact_form_submit: "Kirim pesan",
            footer_copyright: "Hak cipta dilindungi undang-undang.",
            admin_modal_title: "Autentikasi Admin",
            admin_modal_desc: "Masukkan password untuk mengaktifkan mode admin.",
            admin_modal_submit: "Login",
            admin_modal_error: "Password salah!",
            crop_modal_title: "Sesuaikan Foto Profil",
            crop_modal_desc: "Geser gambar dan gunakan slider di bawah untuk menyesuaikan ukuran foto agar pas di dalam bingkai bulat.",
            crop_modal_save: "Terapkan",
            crop_modal_cancel: "Batal",
            project_modal_title: "Tambah Proyek Baru",
            project_modal_desc: "Masukkan detail proyek di bawah ini untuk menambahkan ke portofolio Anda.",
            project_form_cover: "Warna Cover",
            project_form_web_label: "🖥️ Screenshot Tampilan Web",
            project_form_web_placeholder: "📸 Klik untuk Unggah Screenshot Web",
            project_form_mobile_label: "📱 Screenshot Tampilan Mobile",
            project_form_mobile_placeholder: "📸 Klik untuk Unggah Screenshot Mobile",
            project_form_type: "Tipe Proyek",
            project_form_type_web: "Aplikasi Web (dengan Link Situs)",
            project_form_type_design: "Desain UI/UX (Galeri & Link Prototipe)",
            project_form_name_label: "Nama Proyek",
            project_ph_name: "Nama Proyek",
            project_form_link_label: "Link Web Proyek",
            project_form_keywords_label: "Kata Kunci (pisahkan dengan koma)",
            project_ph_keywords: "React, Node.js, Dashboard",
            project_form_submit: "Tambah Proyek",
            admin_status_badge: "Mode Admin Aktif",
            admin_btn_messages: "💬 Pesan Masuk",
            admin_btn_save: "Simpan Perubahan",
            admin_btn_undo: "Undo",
            admin_btn_logout: "Logout",
            toast_saved: "Perubahan berhasil disimpan! ✨",
            toast_undo: "Perubahan berhasil di-undo! ↩️",
            toast_logout: "Keluar dari Mode Admin. Perubahan tidak disimpan.",
            toast_drag_order: "Urutan portofolio diperbarui! 🔄",
            toast_project_added: "Proyek baru berhasil ditambahkan! 🚀",
            toast_project_updated: "Detail proyek berhasil diperbarui! 🚀",
            toast_project_deleted: "Proyek berhasil dihapus.",
            toast_admin_active: "Mode Admin Aktif! Klik teks atau foto untuk mengedit.",
            toast_no_undo: "Tidak ada perubahan untuk di-undo.",
            confirm_undo: "Apakah Anda yakin ingin membatalkan perubahan terakhir (Undo)?",
            confirm_delete_project: "Apakah Anda yakin ingin menghapus proyek ini?",
            confirm_delete_timeline: "Apakah Anda yakin ingin menghapus perjalanan karir ini?",
            confirm_delete_message: "Apakah Anda yakin ingin menghapus pesan ini secara permanen?",
            toast_message_sent: "Pesan Anda berhasil terkirim! Saya akan segera menghubungi Anda. ✉️",
            toast_message_deleted: "Pesan telah dihapus.",
            toast_message_unread: "Pesan ditandai sebagai belum dibaca.",
            msg_sending: "Mengirim... ⏳",
            timeline_new_date: "2026 - Baru",
            timeline_new_title: "Posisi Baru",
            timeline_new_desc: "Deskripsi singkat perjalanan karir baru Anda di sini...",
            lightbox_no_preview: "Tidak ada preview screenshot.",
            admin_msg_title: "Kotak Masuk Pesan",
            admin_msg_desc: "Lihat dan kelola semua pesan yang dikirim oleh pengunjung melalui formulir kontak.",
            admin_msg_search: "🔍 Cari nama atau topik...",
            admin_msg_empty: "Pilih pesan dari daftar untuk membaca detail isi pesan.",
            admin_msg_topic_label: "Topik:",
            admin_msg_mark_unread: "Tandai Belum Dibaca",
            admin_msg_delete: "Hapus Pesan",
            admin_msg_not_found: "Pesan tidak ditemukan.",
            admin_msg_inbox_empty: "Kotak masuk kosong. 📬"
        },
        en: {
            nav_home: "Home",
            nav_about: "About Me",
            nav_timeline: "Timeline",
            nav_experience: "Experience",
            nav_portfolio: "Portfolio",
            nav_contact: "Contact",
            hero_btn_portfolio: "View Portfolio",
            hero_btn_contact: "Contact Me",
            about_title: "About <span>Me</span>",
            about_journey_title: "My journey",
            about_tab_career: "🏢 Career History",
            about_tab_highlights: "🏆 Journey Highlights",
            admin_add_timeline: "➕ Add Career History",
            portfolio_title: "Portfolio",
            portfolio_filter_all: "All Works",
            portfolio_filter_web: "Web Applications",
            portfolio_filter_design: "UI/UX Design",
            contact_title: "Get in <span>Touch</span>",
            contact_left_title: "Fastest way to reach me",
            contact_btn_linkedin: "Send message on LinkedIn",
            contact_linkedin_caption: "Usually replies within one business day.",
            contact_label_location: "Location",
            contact_label_avail: "Availability",
            contact_elsewhere_label: "Find me elsewhere on social media",
            contact_right_title: "Send a message",
            contact_card_subtitle: "Write a short note about your event, team, or project.",
            contact_form_name: "Name",
            contact_ph_name: "Your Name",
            contact_form_email: "Email",
            contact_ph_email: "your.email@example.com",
            contact_form_topic: "Topic",
            topic_ph_select: "Choose topic...",
            topic_opt_collab: "Collaboration / Project",
            topic_opt_job: "Job Opportunity",
            topic_opt_speaking: "Speaking / Workshop Invitation",
            topic_opt_chat: "Just want to say hi!",
            contact_form_message: "Message",
            contact_ph_message: "Write a few sentences about your event, team, or project.",
            contact_form_submit: "Send message",
            footer_copyright: "All rights reserved.",
            admin_modal_title: "Admin Authentication",
            admin_modal_desc: "Enter password to activate admin mode.",
            admin_modal_submit: "Login",
            admin_modal_error: "Incorrect password!",
            crop_modal_title: "Adjust Profile Photo",
            crop_modal_desc: "Pan the image and use the slider below to adjust size to fit the circular frame.",
            crop_modal_save: "Apply",
            crop_modal_cancel: "Cancel",
            project_modal_title: "Add New Project",
            project_modal_desc: "Enter project details below to add to your portfolio.",
            project_form_cover: "Cover Color",
            project_form_web_label: "🖥️ Web View Screenshot",
            project_form_web_placeholder: "📸 Click to Upload Web Screenshot",
            project_form_mobile_label: "📱 Mobile View Screenshot",
            project_form_mobile_placeholder: "📸 Click to Upload Mobile Screenshot",
            project_form_type: "Project Type",
            project_form_type_web: "Web App (with Site Link)",
            project_form_type_design: "UI/UX Design (Gallery & Prototype Link)",
            project_form_name_label: "Project Name",
            project_ph_name: "Project Name",
            project_form_link_label: "Project Web Link",
            project_form_keywords_label: "Keywords (separated by commas)",
            project_ph_keywords: "React, Node.js, Dashboard",
            project_form_submit: "Add Project",
            admin_status_badge: "Admin Mode Active",
            admin_btn_messages: "💬 Inbox Messages",
            admin_btn_save: "Save Changes",
            admin_btn_undo: "Undo",
            admin_btn_logout: "Logout",
            toast_saved: "Changes successfully saved! ✨",
            toast_undo: "Changes successfully undone! ↩️",
            toast_logout: "Logged out of Admin Mode. Changes not saved.",
            toast_drag_order: "Portfolio order updated! 🔄",
            toast_project_added: "New project successfully added! 🚀",
            toast_project_updated: "Project details successfully updated! 🚀",
            toast_project_deleted: "Project deleted.",
            toast_admin_active: "Admin Mode Active! Click text or photo to edit.",
            toast_no_undo: "No changes to undo.",
            confirm_undo: "Are you sure you want to undo your last changes?",
            confirm_delete_project: "Are you sure you want to delete this project?",
            confirm_delete_timeline: "Are you sure you want to delete this career entry?",
            confirm_delete_message: "Are you sure you want to permanently delete this message?",
            toast_message_sent: "Your message has been sent successfully! I will reach out soon. ✉️",
            toast_message_deleted: "Message deleted.",
            toast_message_unread: "Message marked as unread.",
            msg_sending: "Sending... ⏳",
            timeline_new_date: "2026 - New",
            timeline_new_title: "New Position",
            timeline_new_desc: "Short description of your new career journey here...",
            lightbox_no_preview: "No preview screenshot available.",
            admin_msg_title: "Inbox Messages",
            admin_msg_desc: "View and manage all messages sent by visitors through the contact form.",
            admin_msg_search: "🔍 Search name or topic...",
            admin_msg_empty: "Select a message from the list to read the details.",
            admin_msg_topic_label: "Topic:",
            admin_msg_mark_unread: "Mark as Unread",
            admin_msg_delete: "Delete Message",
            admin_msg_not_found: "No messages found.",
            admin_msg_inbox_empty: "Inbox is empty. 📬"
        },
        zh: {
            nav_home: "首页",
            nav_about: "关于我",
            nav_timeline: "时间线",
            nav_experience: "经验",
            nav_portfolio: "作品集",
            nav_contact: "联系方式",
            hero_btn_portfolio: "查看作品集",
            hero_btn_contact: "联系我",
            about_title: "关于<span>我</span>",
            about_journey_title: "我的历程",
            about_tab_career: "🏢 职业历史",
            about_tab_highlights: "🏆 历程亮点",
            admin_add_timeline: "➕ 添加职业经历",
            portfolio_title: "作品集",
            portfolio_filter_all: "所有作品",
            portfolio_filter_web: "Web应用",
            portfolio_filter_design: "UI/UX设计",
            contact_title: "取得<span>联系</span>",
            contact_left_title: "联系我的最快方式",
            contact_btn_linkedin: "在LinkedIn上发送消息",
            contact_linkedin_caption: "通常在一个工作日内回复。",
            contact_label_location: "地点",
            contact_label_avail: "可用性",
            contact_elsewhere_label: "在其他社交媒体上找到我",
            contact_right_title: "发送消息",
            contact_card_subtitle: "写下关于您的活动、团队或项目的简短说明。",
            contact_form_name: "姓名",
            contact_ph_name: "您的姓名",
            contact_form_email: "电子邮件",
            contact_ph_email: "your.email@example.com",
            contact_form_topic: "主题",
            topic_ph_select: "选择主题...",
            topic_opt_collab: "合作 / 项目",
            topic_opt_job: "工作机会",
            topic_opt_speaking: "演讲 / 研讨会邀请",
            topic_opt_chat: "只是想打个招呼！",
            contact_form_message: "消息",
            contact_ph_message: "写几句关于您的活动、团队或项目的话。",
            contact_form_submit: "发送消息",
            footer_copyright: "版权所有。",
            admin_modal_title: "管理员身份验证",
            admin_modal_desc: "输入密码以启用管理员模式。",
            admin_modal_submit: "登录",
            admin_modal_error: "密码错误！",
            crop_modal_title: "调整个人头像",
            crop_modal_desc: "拖动图片并使用下方的滑块调整大小，以适应圆形框架。",
            crop_modal_save: "应用",
            crop_modal_cancel: "取消",
            project_modal_title: "添加新项目",
            project_modal_desc: "在下方输入项目详情以添加到您的作品集中。",
            project_form_cover: "封面颜色",
            project_form_web_label: "🖥️ 网页视图截图",
            project_form_web_placeholder: "📸 点击上传网页截图",
            project_form_mobile_label: "📱 移动视图截图",
            project_form_mobile_placeholder: "📸 点击上传移动截图",
            project_form_type: "项目类型",
            project_form_type_web: "网页应用（含网站链接）",
            project_form_type_design: "UI/UX设计（画廊和原型链接）",
            project_form_name_label: "项目名称",
            project_ph_name: "项目名称",
            project_form_link_label: "项目网页链接",
            project_form_keywords_label: "关键字（用逗号分隔）",
            project_ph_keywords: "React, Node.js, Dashboard",
            project_form_submit: "添加项目",
            admin_status_badge: "管理员模式已激活",
            admin_btn_messages: "💬 收件箱消息",
            admin_btn_save: "保存更改",
            admin_btn_undo: "撤销",
            admin_btn_logout: "退出登录",
            toast_saved: "更改已成功保存！ ✨",
            toast_undo: "更改已成功撤销！ ↩️",
            toast_logout: "已退出管理员模式。更改未保存。",
            toast_drag_order: "作品集顺序已更新！ 🔄",
            toast_project_added: "新项目已成功添加！ 🚀",
            toast_project_updated: "项目详情已成功更新！ 🚀",
            toast_project_deleted: "项目已删除。",
            toast_admin_active: "管理员模式已激活！点击文本或照片进行编辑。",
            toast_no_undo: "没有可撤销的更改。",
            confirm_undo: "您确定要撤销最后的更改吗？",
            confirm_delete_project: "您确定要删除此项目吗？",
            confirm_delete_timeline: "您确定要删除此职业经历吗？",
            confirm_delete_message: "您确定要永久删除此消息吗？",
            toast_message_sent: "您的消息已成功发送！我将尽快与您联系。 ✉️",
            toast_message_deleted: "消息已删除。",
            toast_message_unread: "消息已标记为未读。",
            msg_sending: "发送中... ⏳",
            timeline_new_date: "2026 - 新",
            timeline_new_title: "新职位",
            timeline_new_desc: "在此处简短描述您的新职业经历...",
            lightbox_no_preview: "无预览截图。",
            admin_msg_title: "收件箱消息",
            admin_msg_desc: "查看和管理访客通过联系表单发送的所有消息。",
            admin_msg_search: "🔍 搜索姓名或主题...",
            admin_msg_empty: "从列表中选择一条消息以阅读详细信息。",
            admin_msg_topic_label: "主题：",
            admin_msg_mark_unread: "标记为未读",
            admin_msg_delete: "删除消息",
            admin_msg_not_found: "未找到消息。",
            admin_msg_inbox_empty: "收件箱为空。 📬"
        }
    };

    const EXPERIENCE_GRID_ID = `
            <div class="experience-card glass scroll-reveal has-photo">
              <div class="exp-content">
                <h3 class="exp-title">BBLSDM Komdigi Medan</h3>
                <p class="exp-desc">Berkomitmen menemukan solusi digital paling optimal dan berkinerja tinggi, guna menghasilkan produk akhir yang efisien serta andal.</p>
              </div>
              <div class="card-photo-wrapper" id="card-photo-wrapper-1">
                <img src="./Asset Foto/komdigi.png" id="card-photo-1" class="card-photo" alt="BBLSDM Komdigi">
                <div class="avatar-overlay">
                  <span class="upload-icon">📷</span>
                </div>
              </div>
            </div>
            
            <div class="experience-card glass scroll-reveal scroll-delay-1 has-photo">
              <div class="exp-content">
                <h3 class="exp-title">Freelance</h3>
                <p class="exp-desc">Mempelajari dan menerapkan framework frontend serta backend terbaru untuk membangun aplikasi web yang modern.</p>
              </div>
              <div class="card-photo-wrapper" id="card-photo-wrapper-2">
                <img src="./Asset Foto/freelance.png" id="card-photo-2" class="card-photo" alt="Freelance">
                <div class="avatar-overlay">
                  <span class="upload-icon">📷</span>
                </div>
              </div>
            </div>
            
            <div class="experience-card glass scroll-reveal scroll-delay-2 has-photo">
              <div class="exp-content">
                <h3 class="exp-title">Telkom University</h3>
                <p class="exp-desc">Menempuh pendidikan D4 Teknologi Multimedia (2016&ndash;2020). Berhasil menyelesaikan proyek penelitian berupa pengembangan aset Augmented Reality (AR) untuk denah ruangan gedung Airport Operation Control Center (AOCC) Bandara Soekarno-Hatta.</p>
              </div>
              <div class="card-photo-wrapper" id="card-photo-wrapper-3">
                <img src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=800" id="card-photo-3" class="card-photo" alt="Kampus">
                <div class="avatar-overlay">
                  <span class="upload-icon">📷</span>
                </div>
              </div>
            </div>
            
            <div class="experience-card glass scroll-reveal scroll-delay-3 has-photo">
              <div class="exp-content">
                <h3 class="exp-title">Pascasarjana Universitas Muhammadiyah Sumatera Utara</h3>
                <p class="exp-desc">Menempuh pendidikan S2 Ilmu Komunikasi (2024&ndash;2026). Mengembangkan penelitian tesis mengenai Fenomena &quot;Kabur Aja Dulu&quot; di Platform X, yang berfokus pada analisis sentimen publik serta implikasinya terhadap komunikasi publik.</p>
              </div>
              <div class="card-photo-wrapper" id="card-photo-wrapper-4">
                <img src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=800" id="card-photo-4" class="card-photo" alt="Kampus">
                <div class="avatar-overlay">
                  <span class="upload-icon">📷</span>
                </div>
              </div>
            </div>
    `;

    const EXPERIENCE_GRID_EN = `
            <div class="experience-card glass scroll-reveal has-photo">
              <div class="exp-content">
                <h3 class="exp-title">BBLSDM Komdigi Medan</h3>
                <p class="exp-desc">Committed to finding the most optimal and high-performance digital solutions, to deliver efficient and reliable end products.</p>
              </div>
              <div class="card-photo-wrapper" id="card-photo-wrapper-1">
                <img src="./Asset Foto/komdigi.png" id="card-photo-1" class="card-photo" alt="BBLSDM Komdigi">
                <div class="avatar-overlay">
                  <span class="upload-icon">📷</span>
                </div>
              </div>
            </div>
            
            <div class="experience-card glass scroll-reveal scroll-delay-1 has-photo">
              <div class="exp-content">
                <h3 class="exp-title">Freelance</h3>
                <p class="exp-desc">Learning and applying the latest frontend and backend frameworks to build modern web applications.</p>
              </div>
              <div class="card-photo-wrapper" id="card-photo-wrapper-2">
                <img src="./Asset Foto/freelance.png" id="card-photo-2" class="card-photo" alt="Freelance">
                <div class="avatar-overlay">
                  <span class="upload-icon">📷</span>
                </div>
              </div>
            </div>
            
            <div class="experience-card glass scroll-reveal scroll-delay-2 has-photo">
              <div class="exp-content">
                <h3 class="exp-title">Telkom University</h3>
                <p class="exp-desc">Completed D4 Multimedia Technology education (2016-2020). Successfully completed a research project in the form of developing Augmented Reality (AR) assets for the Airport Operation Control Center (AOCC) building floor plan at Soekarno-Hatta Airport.</p>
              </div>
              <div class="card-photo-wrapper" id="card-photo-wrapper-3">
                <img src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=800" id="card-photo-3" class="card-photo" alt="Campus">
                <div class="avatar-overlay">
                  <span class="upload-icon">📷</span>
                </div>
              </div>
            </div>
            
            <div class="experience-card glass scroll-reveal scroll-delay-3 has-photo">
              <div class="exp-content">
                <h3 class="exp-title">Postgraduate Muhammadiyah University of North Sumatra</h3>
                <p class="exp-desc">Pursuing Master's Degree in Communication Science (2024-2026). Developing thesis research on the "Kabur Aja Dulu" phenomenon on Platform X, focusing on public sentiment analysis and its implications for public communication.</p>
              </div>
              <div class="card-photo-wrapper" id="card-photo-wrapper-4">
                <img src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=800" id="card-photo-4" class="card-photo" alt="Campus">
                <div class="avatar-overlay">
                  <span class="upload-icon">📷</span>
                </div>
              </div>
            </div>
    `;

    const EXPERIENCE_GRID_ZH = `
            <div class="experience-card glass scroll-reveal has-photo">
              <div class="exp-content">
                <h3 class="exp-title">棉兰 Komdigi BBLSDM</h3>
                <p class="exp-desc">致力于寻找最优化和高性能的数字化解决方案，以交付高效且可靠的最终产品。</p>
              </div>
              <div class="card-photo-wrapper" id="card-photo-wrapper-1">
                <img src="./Asset Foto/komdigi.png" id="card-photo-1" class="card-photo" alt="BBLSDM Komdigi">
                <div class="avatar-overlay">
                  <span class="upload-icon">📷</span>
                </div>
              </div>
            </div>
            
            <div class="experience-card glass scroll-reveal scroll-delay-1 has-photo">
              <div class="exp-content">
                <h3 class="exp-title">自由职业</h3>
                <p class="exp-desc">学习并应用最新的前端和后端框架以构建现代Web应用程序。</p>
              </div>
              <div class="card-photo-wrapper" id="card-photo-wrapper-2">
                <img src="./Asset Foto/freelance.png" id="card-photo-2" class="card-photo" alt="Freelance">
                <div class="avatar-overlay">
                  <span class="upload-icon">📷</span>
                </div>
              </div>
            </div>
            
            <div class="experience-card glass scroll-reveal scroll-delay-2 has-photo">
              <div class="exp-content">
                <h3 class="exp-title">电信大学</h3>
                <p class="exp-desc">完成了D4多媒体技术教育（2016-2020）。成功完成了一项研究项目，即为雅加达机场（Soekarno-Hatta）机场运行控制中心（AOCC）大楼的平面图开发增强现实（AR）资产。</p>
              </div>
              <div class="card-photo-wrapper" id="card-photo-wrapper-3">
                <img src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=800" id="card-photo-3" class="card-photo" alt="Campus">
                <div class="avatar-overlay">
                  <span class="upload-icon">📷</span>
                </div>
              </div>
            </div>
            
            <div class="experience-card glass scroll-reveal scroll-delay-3 has-photo">
              <div class="exp-content">
                <h3 class="exp-title">苏门答腊穆罕默德迪亚大学研究生院</h3>
                <p class="exp-desc">攻读传播学硕士学位（2024-2026）。针对X平台上的“Kabur Aja Dulu”现象开展毕业论文研究，重点分析公众舆论及其对公共传播的影响。</p>
              </div>
              <div class="card-photo-wrapper" id="card-photo-wrapper-4">
                <img src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=800" id="card-photo-4" class="card-photo" alt="Campus">
                <div class="avatar-overlay">
                  <span class="upload-icon">📷</span>
                </div>
              </div>
            </div>
    `;

    const TIMELINE_CONTAINER_ID = `
                <div class="timeline-item left scroll-reveal">
                  <div class="content glass">
                    <button class="delete-timeline-btn" title="Hapus Item">🗑️</button>
                    <span class="date">2024 - Sekarang</span>
                    <h3>Fullstack Developer</h3>
                    <p>Membangun berbagai aplikasi internal dan eksternal dengan teknologi terbaru. Bertanggung jawab atas performa, scaling, dan integrasi API yang mulus.</p>
                  </div>
                </div>
                <div class="timeline-item right scroll-reveal scroll-delay-1">
                  <div class="content glass">
                    <button class="delete-timeline-btn" title="Hapus Item">🗑️</button>
                    <span class="date">2023 - 2024</span>
                    <h3>Freelance Web Dev</h3>
                    <p>Mengerjakan proyek-proyek website responsif dan interaktif untuk klien lokal maupun UMKM, meningkatkan penjualan melalui kehadiran digital.</p>
                  </div>
                </div>
                <div class="timeline-item left scroll-reveal scroll-delay-2">
                  <div class="content glass">
                    <button class="delete-timeline-btn" title="Hapus Item">🗑️</button>
                    <span class="date">2022 - 2023</span>
                    <h3>UI/UX Intern</h3>
                    <p>Mempelajari dasar-dasar riset pengguna, desain antarmuka (*wireframing*), dan pembuatan prototipe interaktif untuk pengalaman pengguna terbaik.</p>
                  </div>
                </div>
    `;

    const TIMELINE_CONTAINER_EN = `
                <div class="timeline-item left scroll-reveal">
                  <div class="content glass">
                    <button class="delete-timeline-btn" title="Hapus Item">🗑️</button>
                    <span class="date">2024 - Present</span>
                    <h3>Fullstack Developer</h3>
                    <p>Building various internal and external applications with the latest technology. Responsible for performance, scaling, and seamless API integration.</p>
                  </div>
                </div>
                <div class="timeline-item right scroll-reveal scroll-delay-1">
                  <div class="content glass">
                    <button class="delete-timeline-btn" title="Hapus Item">🗑️</button>
                    <span class="date">2023 - 2024</span>
                    <h3>Freelance Web Dev</h3>
                    <p>Working on responsive and interactive website projects for local clients and MSMEs, increasing sales through digital presence.</p>
                  </div>
                </div>
                <div class="timeline-item left scroll-reveal scroll-delay-2">
                  <div class="content glass">
                    <button class="delete-timeline-btn" title="Hapus Item">🗑️</button>
                    <span class="date">2022 - 2023</span>
                    <h3>UI/UX Intern</h3>
                    <p>Learned the basics of user research, interface design (wireframing), and interactive prototyping for the best user experience.</p>
                  </div>
                </div>
    `;

    const TIMELINE_CONTAINER_ZH = `
                <div class="timeline-item left scroll-reveal">
                  <div class="content glass">
                    <button class="delete-timeline-btn" title="Hapus Item">🗑️</button>
                    <span class="date">2024 - 至今</span>
                    <h3>全栈开发人员</h3>
                    <p>利用最新技术构建各种内部和外部应用程序。负责性能、扩展和无缝API集成。</p>
                  </div>
                </div>
                <div class="timeline-item right scroll-reveal scroll-delay-1">
                  <div class="content glass">
                    <button class="delete-timeline-btn" title="Hapus Item">🗑️</button>
                    <span class="date">2023 - 2024</span>
                    <h3>自由网页开发</h3>
                    <p>为本地客户和中小微企业开发响应式和交互式网站项目，通过数字化展示提升销售额。</p>
                  </div>
                </div>
                <div class="timeline-item left scroll-reveal scroll-delay-2">
                  <div class="content glass">
                    <button class="delete-timeline-btn" title="Hapus Item">🗑️</button>
                    <span class="date">2022 - 2023</span>
                    <h3>UI/UX 实习生</h3>
                    <p>学习用户研究、界面设计（线框图）和交互式原型的基础知识，以提供最佳的用户体验。</p>
                  </div>
                </div>
    `;

    const defaultDynamicTranslations = {
        portfolio_custom_tags: {
            id: `DEVELOPER · CREATIVE SOLVER · DESAINER`,
            en: `DEVELOPER · CREATIVE SOLVER · DESIGNER`,
            zh: `开发人员 · 创意解决者 · 设计师`
        },
        portfolio_custom_name: {
            id: `Prakoso`,
            en: `Prakoso`,
            zh: `Prakoso`
        },
        portfolio_custom_description: {
            id: `Developer yang Berdedikasi & Pemecah Masalah Kreatif · Antusias Teknologi · Kontributor Open Source`,
            en: `Dedicated Developer & Creative Problem Solver · Tech Enthusiast · Open Source Contributor`,
            zh: `敬业的开发人员和创意问题解决者 · 技术爱好者 · 开源贡献者`
        },
        portfolio_custom_about_top_desc: {
            id: `Keseharian saya terbagi antara membangun aplikasi web responsif kelas atas dan mengeksplorasi integrasi AI modern. Sebagian besar bermuara pada satu hal: memanfaatkan teknologi web canggih, dan menjadikannya benar-benar berfungsi di dalam produk premium yang tampak luar biasa dan terasa sangat premium.`,
            en: `My day-to-day is split between building top-tier responsive web applications and exploring modern AI integrations. Most of it boils down to one thing: leveraging advanced web technologies, and making them actually work inside premium products that look amazing and feel extremely premium.`,
            zh: `我的日常生活主要是在构建顶级的响应式Web应用和探索现代AI集成之间分配。大部分工作都可以归结为一件事：利用先进的Web技术，并使其在外观惊艳、体验极其高端的优质产品中真正发挥作用。`
        },
        portfolio_custom_journey_info: {
            id: `📍 Berbasis di Jakarta, Indonesia. Terbuka untuk peluang kerja, kolaborasi, dan undangan pembicara di seluruh dunia, baik secara langsung maupun jarak jauh (remote).`,
            en: `📍 Based in Jakarta, Indonesia. Open for job opportunities, collaboration, and speaking invitations worldwide, both in-person and remote.`,
            zh: `📍 总部位于印尼雅加达。向全球开放工作机会、合作和演讲邀请，支持面议和远程工作。`
        },
        portfolio_custom_journey_text: {
            id: `<p>Saya telah bekerja sebagai Fullstack Developer selama beberapa tahun terakhir, berkolaborasi dengan bisnis lokal maupun klien internasional. Pekerjaan saya, secara garis besar, adalah membantu tim membangun aplikasi yang ramping dan kokoh serta mengintegrasikan micro-animation yang membuat interaksi digital menjadi hidup dan responsif.</p><p>Di samping jalur pemrograman utama saya, saya juga sangat antusias dengan desain UI dan pengalaman pengguna (UX). Saya mempelajari pola desain modern dan tata letak klaster untuk membentuk cara saya berpikir tentang antarmuka yang bersih dan aplikasi dunia nyata yang intuitif.</p><p>Sebagian besar pekerjaan saya berada di antara rekayasa frontend kreatif dan logika backend yang solid. Saya senang mengubah masalah rumit menjadi sistem yang berfungsi, and saya menulis kode yang bersih serta modular agar mudah dipelihara oleh siapa saja.</p>`,
            en: `<p>I have worked as a Fullstack Developer for the past few years, collaborating with local businesses and international clients. My work, broadly speaking, is to help teams build sleek, robust applications and integrate micro-animations that make digital interactions feel alive and responsive.</p><p>Alongside my main programming track, I am also very passionate about UI design and user experience (UX). I study modern design patterns and cluster layouts to shape how I think about clean interfaces and intuitive real-world applications.</p><p>Most of my work lies between creative frontend engineering and solid backend logic. I enjoy turning complex problems into working systems, and I write clean, modular code that is easy for anyone to maintain.</p>`,
            zh: `<p>在过去的几年里，我一直担任全栈开发人员，与本地企业以及国际客户合作。概括地说，我的工作是帮助团队构建精美、健壮的应用程序，并整合微动画，使数字化交互充满活力和响应迅速。</p><p>除了我的主要编程方向之外，我也对 UI 设计和用户体验 (UX) 非常热衷。我研究现代设计模式和集群布局，以塑造我对整洁界面和直观的现实世界应用的思考方式。</p><p>我的大部分工作介于创意前端工程和扎实的后端逻辑之间。我喜欢将复杂的问题转化为正常运行的系统，并编写干净、模块化的代码，以便任何人都可以轻松维护。</p>`
        },
        portfolio_custom_journey_subtitle: {
            id: `Sorotan <span>Perjalanan</span>`,
            en: `Journey <span>Highlights</span>`,
            zh: `旅程 <span>亮点</span>`
        },
        portfolio_custom_timeline_title: {
            id: `Riwayat <span>Karir</span>`,
            en: `Career <span>History</span>`,
            zh: `职业 <span>历史</span>`
        },
        portfolio_custom_contact_desc: {
            id: `Undangan kolaborasi, diskusi proyek baru, atau sekadar bertukar pikiran. Saya selalu senang untuk terhubung dan berinteraksi.`,
            en: `Invitations for collaboration, new project discussions, or simply brainstorming. I'm always happy to connect and interact.`,
            zh: `合作邀请、新项目讨论，或者只是头脑风暴。我总是乐于联系和互动。`
        },
        portfolio_custom_contact_location: {
            id: `Jakarta, Indonesia`,
            en: `Jakarta, Indonesia`,
            zh: `印尼雅加达`
        },
        portfolio_custom_contact_avail: {
            id: `Jarak Jauh (Remote) · Seluruh Dunia`,
            en: `Remote · Worldwide`,
            zh: `远程工作 · 全球`
        },
        portfolio_custom_partners_title: {
            id: `Pengalaman <span>Mengajar</span>`,
            en: `Teaching <span>Experience</span>`,
            zh: `教学 <span>经历</span>`
        },
        portfolio_custom_experience_grid: {
            id: EXPERIENCE_GRID_ID.trim(),
            en: EXPERIENCE_GRID_EN.trim(),
            zh: EXPERIENCE_GRID_ZH.trim()
        },
        portfolio_custom_timeline_container: {
            id: TIMELINE_CONTAINER_ID.trim(),
            en: TIMELINE_CONTAINER_EN.trim(),
            zh: TIMELINE_CONTAINER_ZH.trim()
        }
    };

    let currentLang = appStore.getItem('portfolio_language') || 'id';

    const getStorageKey = (baseKey, lang) => {
        if (lang === 'id') return baseKey;
        return `${baseKey}_${lang}`;
    };

    const getLangValue = (baseKey, lang) => {
        const langKey = getStorageKey(baseKey, lang);
        const val = appStore.getItem(langKey);
        if (val !== null && val.trim() !== '') {
            return val;
        }
        if (defaultDynamicTranslations[baseKey] && defaultDynamicTranslations[baseKey][lang]) {
            return defaultDynamicTranslations[baseKey][lang];
        }
        const idVal = appStore.getItem(baseKey);
        if (idVal !== null && idVal.trim() !== '') {
            return idVal;
        }
        if (defaultDynamicTranslations[baseKey] && defaultDynamicTranslations[baseKey]['id']) {
            return defaultDynamicTranslations[baseKey]['id'];
        }
        return '';
    };

    const getProjectsForLang = (lang) => {
        const langKey = getStorageKey('portfolio_dynamic_projects', lang);
        let projectsRaw = appStore.getItem(langKey);
        let projects = [];
        if (projectsRaw !== null && projectsRaw.trim() !== '') {
            projects = JSON.parse(projectsRaw);
        } else {
            let idProjectsRaw = appStore.getItem('portfolio_dynamic_projects');
            if (idProjectsRaw !== null && idProjectsRaw.trim() !== '') {
                projects = JSON.parse(idProjectsRaw);
            } else {
                projects = [
                    {
                        id: 'default-1',
                        type: 'web',
                        name: 'Portal Citra Graha',
                        keywords: 'Laravel, Maps, Dashboard',
                        coverColor: '#0f2035',
                        link: 'https://github.com',
                        webScreenshot: './Asset Foto/web_1.png',
                        mobileScreenshot: './Asset Foto/mobile_1.png'
                    },
                    {
                        id: 'default-2',
                        type: 'web',
                        name: 'Silsilah Keluarga',
                        keywords: 'React, Node.js, Visualisasi',
                        coverColor: '#1e1030',
                        link: 'https://github.com',
                        webScreenshot: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800',
                        mobileScreenshot: ''
                    },
                    {
                        id: 'default-3',
                        type: 'web',
                        name: 'Keuangan Pribadi ASN',
                        keywords: 'Vue.js, OCR, Finance',
                        coverColor: '#0d2818',
                        link: 'https://github.com',
                        webScreenshot: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800',
                        mobileScreenshot: ''
                    },
                    {
                        id: 'dribbble-1',
                        type: 'design',
                        name: 'Weather App UI',
                        keywords: 'Figma, Mobile, Dark Mode',
                        coverColor: '#0d1f2a',
                        link: '',
                        webScreenshot: './Asset Foto/weather_ui.png',
                        mobileScreenshot: ''
                    },
                    {
                        id: 'dribbble-2',
                        type: 'design',
                        name: 'BOLSO Financial Dashboard',
                        keywords: 'Figma, Dashboard, Fintech',
                        coverColor: '#111828',
                        link: '',
                        webScreenshot: './Asset Foto/wallet_ui.png',
                        mobileScreenshot: ''
                    },
                    {
                        id: 'dribbble-3',
                        type: 'design',
                        name: 'Life Insurance Onboarding',
                        keywords: 'Figma, Onboarding, Insurance',
                        coverColor: '#2a0d1e',
                        link: '',
                        webScreenshot: './Asset Foto/insurance_ui.png',
                        mobileScreenshot: ''
                    }
                ];
                appStore.setItem('portfolio_dynamic_projects', JSON.stringify(projects));
            }
        }
        
        let migrated = false;
        projects.forEach(p => {
            if (!p.type) { p.type = 'web'; migrated = true; }
            if (!p.keywords) { p.keywords = ''; migrated = true; }
            if (!p.coverColor) { p.coverColor = '#0f2035'; migrated = true; }
            if (p.webScreenshot === undefined) {
                p.webScreenshot = p.logo || '';
                p.mobileScreenshot = '';
                migrated = true;
            }
            if (p.mobileScreenshot === undefined) { p.mobileScreenshot = ''; migrated = true; }
        });
        if (migrated) {
            appStore.setItem(getStorageKey('portfolio_dynamic_projects', lang), JSON.stringify(projects));
        }
        return projects;
    };

    // --- LANGUAGE SWITCHER DROPDOWN LOGIC ---
    const langBtn = document.getElementById('lang-btn');
    const langDropdown = document.getElementById('lang-dropdown');
    const langOpts = document.querySelectorAll('.lang-opt');
    const activeLangText = document.querySelector('.active-lang-text');

    if (langBtn && langDropdown) {
        langBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            langDropdown.classList.toggle('open');
        });
        window.addEventListener('click', (e) => {
            if (!langDropdown.contains(e.target) && e.target !== langBtn) {
                langDropdown.classList.remove('open');
            }
        });
    }

    if (langOpts) {
        langOpts.forEach(opt => {
            opt.addEventListener('click', () => {
                const targetLang = opt.getAttribute('data-lang');
                if (targetLang) {
                    applyLanguage(targetLang);
                    if (langDropdown) {
                        langDropdown.classList.remove('open');
                    }
                }
            });
        });
    }

    const applyLanguage = (lang) => {
        currentLang = lang;
        appStore.setItem('portfolio_language', lang);
        if (activeLangText) activeLangText.innerText = lang.toUpperCase();
        if (langOpts) {
            langOpts.forEach(opt => {
                opt.classList.toggle('active', opt.getAttribute('data-lang') === lang);
            });
        }
        const i18nElements = document.querySelectorAll('[data-i18n]');
        i18nElements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[lang] && translations[lang][key] !== undefined) {
                if (el.tagName === 'OPTION') {
                    el.text = translations[lang][key];
                } else {
                    el.innerHTML = translations[lang][key];
                }
            }
        });
        const i18nPlaceholders = document.querySelectorAll('[data-i18n-ph]');
        i18nPlaceholders.forEach(el => {
            const key = el.getAttribute('data-i18n-ph');
            if (translations[lang] && translations[lang][key] !== undefined) {
                el.setAttribute('placeholder', translations[lang][key]);
            }
        });
        hydrateContent();
        renderProjects();
    };

    // 1. Hydrate content from localStorage on load
    const hydrateContent = () => {
        const schemaVersion = appStore.getItem('portfolio_schema_version');
        if (schemaVersion !== '3') {
            appStore.removeItem('portfolio_dynamic_projects');
            appStore.setItem('portfolio_schema_version', '3');
        }

        const savedTags = getLangValue('portfolio_custom_tags', currentLang);
        const savedName = getLangValue('portfolio_custom_name', currentLang);
        const savedDesc = getLangValue('portfolio_custom_description', currentLang);
        const savedAvatar = getLangValue('portfolio_custom_avatar', currentLang);
        
        const savedJourneySubtitle = getLangValue('portfolio_custom_journey_subtitle', currentLang);
        const savedAboutTopDesc = getLangValue('portfolio_custom_about_top_desc', currentLang);
        const savedAboutImg = getLangValue('portfolio_custom_about_img', currentLang);
        const savedJourneyInfo = getLangValue('portfolio_custom_journey_info', currentLang);
        const savedJourneyText = getLangValue('portfolio_custom_journey_text', currentLang);
        const savedExperienceGrid = getLangValue('portfolio_custom_experience_grid', currentLang);
        const savedTimelineTitle = getLangValue('portfolio_custom_timeline_title', currentLang);
        const savedTimelineContainer = getLangValue('portfolio_custom_timeline_container', currentLang);
        
        const savedContactTitle = getLangValue('portfolio_custom_contact_title', currentLang);
        const savedContactDesc = getLangValue('portfolio_custom_contact_desc', currentLang);
        const savedContactLeftTitle = getLangValue('portfolio_custom_contact_left_title', currentLang);
        const savedContactLocation = getLangValue('portfolio_custom_contact_location', currentLang);
        const savedContactAvail = getLangValue('portfolio_custom_contact_avail', currentLang);
        const savedContactRightTitle = getLangValue('portfolio_custom_contact_right_title', currentLang);
        const savedPartnersTitle = getLangValue('portfolio_custom_partners_title', currentLang);
        
        const savedPresentasiNum = getLangValue('portfolio_custom_presentasi_num', currentLang);
        const savedPesertaNum = getLangValue('portfolio_custom_peserta_num', currentLang);
        const savedPhotoTesti = getLangValue('portfolio_custom_photo_testi', currentLang);
        const savedEventPhotos = getLangValue('portfolio_custom_event_photos', currentLang);
        
        if (savedTags && savedTags.trim() !== '') editableTags.innerHTML = savedTags;
        if (savedName && savedName.trim() !== '') editableName.innerText = savedName;
        if (savedDesc && savedDesc.trim() !== '') editableDescription.innerText = savedDesc;
        if (savedAvatar && savedAvatar.trim() !== '') editableAvatar.src = savedAvatar;
        
        if (savedJourneySubtitle && editableJourneySubtitle && savedJourneySubtitle.trim() !== '') editableJourneySubtitle.innerHTML = savedJourneySubtitle;
        if (savedAboutTopDesc && editableAboutTopDesc && savedAboutTopDesc.trim() !== '') editableAboutTopDesc.innerHTML = savedAboutTopDesc;
        if (savedAboutImg && editableAboutImg && savedAboutImg.trim() !== '') editableAboutImg.src = savedAboutImg;
        if (savedJourneyInfo && editableJourneyInfo && savedJourneyInfo.trim() !== '') editableJourneyInfo.innerHTML = savedJourneyInfo;
        if (savedJourneyText && editableJourneyText && savedJourneyText.trim() !== '') editableJourneyText.innerHTML = savedJourneyText;
        if (savedExperienceGrid && editableExperienceGrid && savedExperienceGrid.trim() !== '') editableExperienceGrid.innerHTML = savedExperienceGrid;
        if (savedTimelineTitle && editableTimelineTitle && savedTimelineTitle.trim() !== '') editableTimelineTitle.innerHTML = savedTimelineTitle;
        if (savedTimelineContainer && editableTimelineContainer && savedTimelineContainer.trim() !== '') {
            editableTimelineContainer.innerHTML = savedTimelineContainer;
        }
        
        if (editableTimelineContainer) {
            const contents = editableTimelineContainer.querySelectorAll('.content');
            contents.forEach(content => {
                if (!content.querySelector('.delete-timeline-btn')) {
                    const btn = document.createElement('button');
                    btn.className = 'delete-timeline-btn';
                    btn.title = 'Hapus Item';
                    btn.innerHTML = '🗑️';
                    content.insertBefore(btn, content.firstChild);
                }
            });
        }
        
        if (savedContactTitle && editableContactTitle && savedContactTitle.trim() !== '') editableContactTitle.innerHTML = savedContactTitle;
        if (savedContactDesc && editableContactDesc && savedContactDesc.trim() !== '') editableContactDesc.innerHTML = savedContactDesc;
        if (savedContactLeftTitle && editableContactLeftTitle && savedContactLeftTitle.trim() !== '') editableContactLeftTitle.innerHTML = savedContactLeftTitle;
        if (savedContactLocation && editableContactLocation && savedContactLocation.trim() !== '') editableContactLocation.innerHTML = savedContactLocation;
        if (savedContactAvail && editableContactAvail && savedContactAvail.trim() !== '') editableContactAvail.innerHTML = savedContactAvail;
        if (savedContactRightTitle && editableContactRightTitle && savedContactRightTitle.trim() !== '') editableContactRightTitle.innerHTML = savedContactRightTitle;
        if (savedPartnersTitle && editablePartnersTitle && savedPartnersTitle.trim() !== '') editablePartnersTitle.innerHTML = savedPartnersTitle;
        
        if (savedPresentasiNum && editablePresentasiNum && savedPresentasiNum.trim() !== '') editablePresentasiNum.innerHTML = savedPresentasiNum;
        if (savedPesertaNum && editablePesertaNum && savedPesertaNum.trim() !== '') editablePesertaNum.innerHTML = savedPesertaNum;
        if (savedPhotoTesti && cardPhotoTesti && savedPhotoTesti.trim() !== '') cardPhotoTesti.src = savedPhotoTesti;
        if (savedEventPhotos) {
            try {
                const photos = JSON.parse(savedEventPhotos);
                photos.forEach((src, index) => {
                    const img = document.getElementById(`event-photo-${index + 1}`);
                    if (img && src) img.src = src;
                });
            } catch(e) {}
        }
        
        const savedPartnerLogos = getLangValue('portfolio_partner_logos', currentLang);
        if (savedPartnerLogos) {
            try {
                const partnerLogos = JSON.parse(savedPartnerLogos);
                partnerLogos.forEach((src, index) => {
                    const img = document.getElementById(`partner-logo-${index + 1}`);
                    if (img) img.src = src;
                });
            } catch(e) {
                console.error("Failed parsing partner logos", e);
            }
        } else {
            for (let i = 1; i <= 12; i++) {
                const img = document.getElementById(`partner-logo-${i}`);
                if (img) img.src = getDefaultPartnerLogoSvg(i);
            }
        }

        observeElements();
    };

    applyLanguage(currentLang);
    
    // 2. Secret Admin Control (Google Auth)
    if (adminTrigger) {
        adminTrigger.addEventListener('click', async () => {
            try {
                const result = await signInWithPopup(auth, provider);
                const user = result.user;
                if (adminWhitelist.includes(user.email)) {
                    enterAdminMode();
                } else {
                    await signOut(auth);
                    showToast("Akses ditolak: Email Anda tidak ada dalam whitelist.");
                }
            } catch (error) {
                console.error("Login failed", error);
                showToast("Login gagal atau dibatalkan.");
            }
        });
    }
    
    // Listen for auth state to auto-login
    onAuthStateChanged(auth, (user) => {
        if (user && adminWhitelist.includes(user.email)) {
            // Already logged in
            enterAdminMode();
        }
    });
    
    // 4. Enter Admin Mode
    const enterAdminMode = () => {
        isAdminActive = true;
        document.body.classList.add('admin-mode-active');
        
        // Show Admin Floating Bar
        adminControlBar.style.display = 'block';
        setTimeout(() => {
            adminControlBar.classList.add('active');
        }, 50);
        updateUnreadBadge();
        
        // Make text elements editable
        editableTags.contentEditable = "true";
        editableName.contentEditable = "true";
        editableDescription.contentEditable = "true";
        
        // About Me & Journey & Experience editable elements
        if (editableJourneySubtitle) editableJourneySubtitle.contentEditable = "true";
        if (editableAboutTopDesc) editableAboutTopDesc.contentEditable = "true";
        if (editableJourneyInfo) editableJourneyInfo.contentEditable = "true";
        if (editableJourneyText) editableJourneyText.contentEditable = "true";
        if (editableExperienceGrid) {
            const editableTitles = editableExperienceGrid.querySelectorAll('.exp-title');
            const editableDescs = editableExperienceGrid.querySelectorAll('.exp-desc');
            const editableIcons = editableExperienceGrid.querySelectorAll('.exp-icon');
            
            editableTitles.forEach(el => el.contentEditable = "true");
            editableDescs.forEach(el => el.contentEditable = "true");
            editableIcons.forEach(el => el.contentEditable = "true");
        }
        
        // Timeline editable elements
        if (editableTimelineTitle) editableTimelineTitle.contentEditable = "true";
        if (editableTimelineContainer) {
            const editableDates = editableTimelineContainer.querySelectorAll('.date');
            const editableTitles = editableTimelineContainer.querySelectorAll('h3');
            const editableParagraphs = editableTimelineContainer.querySelectorAll('p');
            
            editableDates.forEach(el => el.contentEditable = "true");
            editableTitles.forEach(el => el.contentEditable = "true");
            editableParagraphs.forEach(el => el.contentEditable = "true");
        }
        
        // Contact Section editable elements
        if (editableContactTitle) editableContactTitle.contentEditable = "true";
        if (editableContactDesc) editableContactDesc.contentEditable = "true";
        if (editableContactLeftTitle) editableContactLeftTitle.contentEditable = "true";
        if (editableContactLocation) editableContactLocation.contentEditable = "true";
        if (editableContactAvail) editableContactAvail.contentEditable = "true";
        if (editableContactRightTitle) editableContactRightTitle.contentEditable = "true";
        if (editablePartnersTitle) editablePartnersTitle.contentEditable = "true";
        
        if (editablePresentasiNum) editablePresentasiNum.contentEditable = "true";
        if (editablePesertaNum) editablePesertaNum.contentEditable = "true";
        
        // Show Timeline Admin Actions
        const adminTimelineActions = document.getElementById('admin-timeline-actions');
        if (adminTimelineActions) adminTimelineActions.style.display = 'block';
        
        // Backup current content
        tempBackup = {
            tags: editableTags.innerHTML,
            name: editableName.innerText,
            description: editableDescription.innerText,
            avatarSrc: editableAvatar.src,
            journeySubtitle: editableJourneySubtitle ? editableJourneySubtitle.innerHTML : '',
            aboutTopDesc: editableAboutTopDesc ? editableAboutTopDesc.innerHTML : '',
            aboutImgSrc: editableAboutImg ? editableAboutImg.src : '',
            journeyInfo: editableJourneyInfo ? editableJourneyInfo.innerHTML : '',
            journeyText: editableJourneyText ? editableJourneyText.innerHTML : '',
            experienceGrid: editableExperienceGrid ? editableExperienceGrid.innerHTML : '',
            timelineTitle: editableTimelineTitle ? editableTimelineTitle.innerHTML : '',
            timelineContainer: editableTimelineContainer ? editableTimelineContainer.innerHTML : '',
            contactTitle: editableContactTitle ? editableContactTitle.innerHTML : '',
            contactDesc: editableContactDesc ? editableContactDesc.innerHTML : '',
            contactLeftTitle: editableContactLeftTitle ? editableContactLeftTitle.innerHTML : '',
            contactLocation: editableContactLocation ? editableContactLocation.innerHTML : '',
            contactAvail: editableContactAvail ? editableContactAvail.innerHTML : '',
            contactRightTitle: editableContactRightTitle ? editableContactRightTitle.innerHTML : '',
            partnersTitle: editablePartnersTitle ? editablePartnersTitle.innerHTML : '',
            presentasiNum: editablePresentasiNum ? editablePresentasiNum.innerHTML : '',
            pesertaNum: editablePesertaNum ? editablePesertaNum.innerHTML : '',
            photoTesti: cardPhotoTesti ? cardPhotoTesti.src : '',
            eventPhotos: [1,2,3,4,5,6].map(i => {
                const img = document.getElementById(`event-photo-${i}`);
                return img ? img.src : '';
            }),
            partnerLogos: Array.from({length: 12}, (_, i) => {
                const img = document.getElementById(`partner-logo-${i+1}`);
                return img ? img.src : '';
            }),
            projects: getProjectsForLang(currentLang)
        };
        
        renderProjects();
        showToast(translations[currentLang].toast_admin_active);
    };
    
    // 5. Save Admin Changes (saves but keeps admin mode active)
    const saveAdminChanges = async () => {
        const saveBtn = document.getElementById('admin-save-btn');
        let originalText = "Simpan Perubahan";
        if (saveBtn) {
            originalText = saveBtn.innerText;
            saveBtn.innerText = "Menyimpan...";
            saveBtn.disabled = true;
        }

        // Intelligent formatting for tags before saving
        let rawTags = editableTags.innerText;
        let tagList = rawTags.replace(/·/g, ',').replace(/\./g, ',').split(',');
        let formattedHtml = tagList
            .map(t => t.trim())
            .filter(t => t.length > 0)
            .map(t => `<span>${t.toUpperCase()}</span>`)
            .join(' · ');
        editableTags.innerHTML = formattedHtml;

        // Save to localStorage using lang-specific keys
        appStore.setItem(getStorageKey('portfolio_custom_tags', currentLang), editableTags.innerHTML);
        appStore.setItem(getStorageKey('portfolio_custom_name', currentLang), editableName.innerText);
        appStore.setItem(getStorageKey('portfolio_custom_description', currentLang), editableDescription.innerText);
        appStore.setItem(getStorageKey('portfolio_custom_avatar', currentLang), editableAvatar.src);
        
        // About Me & Journey & Experience saving
        if (editableJourneySubtitle) appStore.setItem(getStorageKey('portfolio_custom_journey_subtitle', currentLang), editableJourneySubtitle.innerHTML);
        if (editableAboutTopDesc) appStore.setItem(getStorageKey('portfolio_custom_about_top_desc', currentLang), editableAboutTopDesc.innerHTML);
        if (editableAboutImg) appStore.setItem(getStorageKey('portfolio_custom_about_img', currentLang), editableAboutImg.src);
        if (editableJourneyInfo) appStore.setItem(getStorageKey('portfolio_custom_journey_info', currentLang), editableJourneyInfo.innerHTML);
        if (editableJourneyText) appStore.setItem(getStorageKey('portfolio_custom_journey_text', currentLang), editableJourneyText.innerHTML);
        if (editableExperienceGrid) appStore.setItem(getStorageKey('portfolio_custom_experience_grid', currentLang), editableExperienceGrid.innerHTML);
        if (editableTimelineTitle) appStore.setItem(getStorageKey('portfolio_custom_timeline_title', currentLang), editableTimelineTitle.innerHTML);
        if (editableTimelineContainer) appStore.setItem(getStorageKey('portfolio_custom_timeline_container', currentLang), editableTimelineContainer.innerHTML);
        
        if (editableContactTitle) appStore.setItem(getStorageKey('portfolio_custom_contact_title', currentLang), editableContactTitle.innerHTML);
        if (editableContactDesc) appStore.setItem(getStorageKey('portfolio_custom_contact_desc', currentLang), editableContactDesc.innerHTML);
        if (editableContactLeftTitle) appStore.setItem(getStorageKey('portfolio_custom_contact_left_title', currentLang), editableContactLeftTitle.innerHTML);
        if (editableContactLocation) appStore.setItem(getStorageKey('portfolio_custom_contact_location', currentLang), editableContactLocation.innerHTML);
        if (editableContactAvail) appStore.setItem(getStorageKey('portfolio_custom_contact_avail', currentLang), editableContactAvail.innerHTML);
        if (editableContactRightTitle) appStore.setItem(getStorageKey('portfolio_custom_contact_right_title', currentLang), editableContactRightTitle.innerHTML);
        if (editablePartnersTitle) appStore.setItem(getStorageKey('portfolio_custom_partners_title', currentLang), editablePartnersTitle.innerHTML);
        
        if (editablePresentasiNum) appStore.setItem(getStorageKey('portfolio_custom_presentasi_num', currentLang), editablePresentasiNum.innerHTML);
        if (editablePesertaNum) appStore.setItem(getStorageKey('portfolio_custom_peserta_num', currentLang), editablePesertaNum.innerHTML);
        if (cardPhotoTesti) appStore.setItem(getStorageKey('portfolio_custom_photo_testi', currentLang), cardPhotoTesti.src);
        const savedEvents = [1,2,3,4,5,6].map(i => {
            const img = document.getElementById(`event-photo-${i}`);
            return img ? img.src : '';
        });
        appStore.setItem(getStorageKey('portfolio_custom_event_photos', currentLang), JSON.stringify(savedEvents));
        
        // Save partner logos
        const partnerLogos = [];
        for (let i = 1; i <= 12; i++) {
            const img = document.getElementById(`partner-logo-${i}`);
            if (img) {
                partnerLogos.push(img.src);
            }
        }
        appStore.setItem(getStorageKey('portfolio_partner_logos', currentLang), JSON.stringify(partnerLogos));
        
        // Update backup to the newly saved state so that next undo reverts to this state!
        tempBackup = {
            tags: editableTags.innerHTML,
            name: editableName.innerText,
            description: editableDescription.innerText,
            avatarSrc: editableAvatar.src,
            journeySubtitle: editableJourneySubtitle ? editableJourneySubtitle.innerHTML : '',
            aboutTopDesc: editableAboutTopDesc ? editableAboutTopDesc.innerHTML : '',
            aboutImgSrc: editableAboutImg ? editableAboutImg.src : '',
            journeyInfo: editableJourneyInfo ? editableJourneyInfo.innerHTML : '',
            journeyText: editableJourneyText ? editableJourneyText.innerHTML : '',
            experienceGrid: editableExperienceGrid ? editableExperienceGrid.innerHTML : '',
            timelineTitle: editableTimelineTitle ? editableTimelineTitle.innerHTML : '',
            timelineContainer: editableTimelineContainer ? editableTimelineContainer.innerHTML : '',
            contactTitle: editableContactTitle ? editableContactTitle.innerHTML : '',
            contactDesc: editableContactDesc ? editableContactDesc.innerHTML : '',
            contactLeftTitle: editableContactLeftTitle ? editableContactLeftTitle.innerHTML : '',
            contactLocation: editableContactLocation ? editableContactLocation.innerHTML : '',
            contactAvail: editableContactAvail ? editableContactAvail.innerHTML : '',
            contactRightTitle: editableContactRightTitle ? editableContactRightTitle.innerHTML : '',
            partnersTitle: editablePartnersTitle ? editablePartnersTitle.innerHTML : '',
            presentasiNum: editablePresentasiNum ? editablePresentasiNum.innerHTML : '',
            pesertaNum: editablePesertaNum ? editablePesertaNum.innerHTML : '',
            photoTesti: cardPhotoTesti ? cardPhotoTesti.src : '',
            eventPhotos: savedEvents,
            partnerLogos: partnerLogos,
            projects: getProjectsForLang(currentLang)
        };

        await syncToFirebase(true);

        showToast(translations[currentLang].toast_saved);
        renderProjects();
        
        if (saveBtn) {
            saveBtn.innerText = originalText;
            saveBtn.disabled = false;
        }
    };

    // 6. Undo Admin Changes (reverts UI and localStorage to backup state)
    const undoAdminChanges = () => {
        if (!tempBackup || Object.keys(tempBackup).length === 0) {
            showToast(translations[currentLang].toast_no_undo, true);
            return;
        }

        if (confirm(translations[currentLang].confirm_undo)) {
            // Restore from backup
            editableTags.innerHTML = tempBackup.tags;
            editableName.innerText = tempBackup.name;
            editableDescription.innerText = tempBackup.description;
            editableAvatar.src = tempBackup.avatarSrc;
            
            // About Me restore
            if (editableJourneySubtitle) editableJourneySubtitle.innerHTML = tempBackup.journeySubtitle;
            if (editableAboutTopDesc) editableAboutTopDesc.innerHTML = tempBackup.aboutTopDesc;
            if (editableAboutImg) editableAboutImg.src = tempBackup.aboutImgSrc;
            if (editableJourneyInfo) editableJourneyInfo.innerHTML = tempBackup.journeyInfo;
            if (editableJourneyText) editableJourneyText.innerHTML = tempBackup.journeyText;
            if (editableExperienceGrid) editableExperienceGrid.innerHTML = tempBackup.experienceGrid;
            if (editableTimelineTitle) editableTimelineTitle.innerHTML = tempBackup.timelineTitle;
            if (editableTimelineContainer) editableTimelineContainer.innerHTML = tempBackup.timelineContainer;
            
            if (editableContactTitle) editableContactTitle.innerHTML = tempBackup.contactTitle;
            if (editableContactDesc) editableContactDesc.innerHTML = tempBackup.contactDesc;
            if (editableContactLeftTitle) editableContactLeftTitle.innerHTML = tempBackup.contactLeftTitle;
            if (editableContactLocation) editableContactLocation.innerHTML = tempBackup.contactLocation;
            if (editableContactAvail) editableContactAvail.innerHTML = tempBackup.contactAvail;
            if (editableContactRightTitle) editableContactRightTitle.innerHTML = tempBackup.contactRightTitle;
            if (editablePartnersTitle) editablePartnersTitle.innerHTML = tempBackup.partnersTitle;
            
            if (editablePresentasiNum) editablePresentasiNum.innerHTML = tempBackup.presentasiNum;
            if (editablePesertaNum) editablePesertaNum.innerHTML = tempBackup.pesertaNum;
            if (cardPhotoTesti) cardPhotoTesti.src = tempBackup.photoTesti;
            if (tempBackup.eventPhotos) {
                tempBackup.eventPhotos.forEach((src, index) => {
                    const img = document.getElementById(`event-photo-${index + 1}`);
                    if (img && src) img.src = src;
                });
            }
            
            // Restore partner logos
            if (tempBackup.partnerLogos) {
                tempBackup.partnerLogos.forEach((src, index) => {
                    const img = document.getElementById(`partner-logo-${index + 1}`);
                    if (img) {
                        img.src = src;
                    }
                });
            }

            // Save the reverted state to localStorage using lang-specific keys
            appStore.setItem(getStorageKey('portfolio_custom_tags', currentLang), tempBackup.tags);
            appStore.setItem(getStorageKey('portfolio_custom_name', currentLang), tempBackup.name);
            appStore.setItem(getStorageKey('portfolio_custom_description', currentLang), tempBackup.description);
            appStore.setItem(getStorageKey('portfolio_custom_avatar', currentLang), tempBackup.avatarSrc);
            
            if (editableJourneySubtitle) appStore.setItem(getStorageKey('portfolio_custom_journey_subtitle', currentLang), tempBackup.journeySubtitle);
            if (editableAboutTopDesc) appStore.setItem(getStorageKey('portfolio_custom_about_top_desc', currentLang), tempBackup.aboutTopDesc);
            if (editableAboutImg) appStore.setItem(getStorageKey('portfolio_custom_about_img', currentLang), tempBackup.aboutImgSrc);
            if (editableJourneyInfo) appStore.setItem(getStorageKey('portfolio_custom_journey_info', currentLang), tempBackup.journeyInfo);
            if (editableJourneyText) appStore.setItem(getStorageKey('portfolio_custom_journey_text', currentLang), tempBackup.journeyText);
            if (editableExperienceGrid) appStore.setItem(getStorageKey('portfolio_custom_experience_grid', currentLang), tempBackup.experienceGrid);
            if (editableTimelineTitle) appStore.setItem(getStorageKey('portfolio_custom_timeline_title', currentLang), tempBackup.timelineTitle);
            if (editableTimelineContainer) appStore.setItem(getStorageKey('portfolio_custom_timeline_container', currentLang), tempBackup.timelineContainer);
            
            if (editableContactTitle) appStore.setItem(getStorageKey('portfolio_custom_contact_title', currentLang), tempBackup.contactTitle);
            if (editableContactDesc) appStore.setItem(getStorageKey('portfolio_custom_contact_desc', currentLang), tempBackup.contactDesc);
            if (editableContactLeftTitle) appStore.setItem(getStorageKey('portfolio_custom_contact_left_title', currentLang), tempBackup.contactLeftTitle);
            if (editableContactLocation) appStore.setItem(getStorageKey('portfolio_custom_contact_location', currentLang), tempBackup.contactLocation);
            if (editableContactAvail) appStore.setItem(getStorageKey('portfolio_custom_contact_avail', currentLang), tempBackup.contactAvail);
            if (editableContactRightTitle) appStore.setItem(getStorageKey('portfolio_custom_contact_right_title', currentLang), tempBackup.contactRightTitle);
            if (editablePartnersTitle) appStore.setItem(getStorageKey('portfolio_custom_partners_title', currentLang), tempBackup.partnersTitle);
            
            if (editablePresentasiNum) appStore.setItem(getStorageKey('portfolio_custom_presentasi_num', currentLang), tempBackup.presentasiNum);
            if (editablePesertaNum) appStore.setItem(getStorageKey('portfolio_custom_peserta_num', currentLang), tempBackup.pesertaNum);
            if (cardPhotoTesti) appStore.setItem(getStorageKey('portfolio_custom_photo_testi', currentLang), tempBackup.photoTesti);
            if (tempBackup.eventPhotos) appStore.setItem(getStorageKey('portfolio_custom_event_photos', currentLang), JSON.stringify(tempBackup.eventPhotos));
            
            if (tempBackup.partnerLogos) {
                appStore.setItem(getStorageKey('portfolio_partner_logos', currentLang), JSON.stringify(tempBackup.partnerLogos));
            }
            if (tempBackup.projects) {
                appStore.setItem(getStorageKey('portfolio_dynamic_projects', currentLang), JSON.stringify(tempBackup.projects));
            }

            renderProjects();
            showToast(translations[currentLang].toast_undo);
        }
    };

    // 7. Exit Admin Mode (deactivates editability and logs out)
    const exitAdminMode = async (saveChanges) => {
        isAdminActive = false;
        document.body.classList.remove('admin-mode-active');
        
        // Hide Admin Floating Bar
        adminControlBar.classList.remove('active');
        setTimeout(() => {
            adminControlBar.style.display = 'none';
        }, 500);
        
        // Hide Timeline Admin Actions
        const adminTimelineActions = document.getElementById('admin-timeline-actions');
        if (adminTimelineActions) adminTimelineActions.style.display = 'none';
        
        // Disable editability
        editableTags.contentEditable = "false";
        editableName.contentEditable = "false";
        editableDescription.contentEditable = "false";
        if (editableJourneySubtitle) editableJourneySubtitle.contentEditable = "false";
        if (editableAboutTopDesc) editableAboutTopDesc.contentEditable = "false";
        if (editableJourneyInfo) editableJourneyInfo.contentEditable = "false";
        if (editableJourneyText) editableJourneyText.contentEditable = "false";
        if (editableExperienceGrid) {
            const editableTitles = editableExperienceGrid.querySelectorAll('.exp-title');
            const editableDescs = editableExperienceGrid.querySelectorAll('.exp-desc');
            const editableIcons = editableExperienceGrid.querySelectorAll('.exp-icon');
            
            editableTitles.forEach(el => el.contentEditable = "false");
            editableDescs.forEach(el => el.contentEditable = "false");
            editableIcons.forEach(el => el.contentEditable = "false");
        }
        if (editableTimelineTitle) editableTimelineTitle.contentEditable = "false";
        if (editableTimelineContainer) {
            const editableDates = editableTimelineContainer.querySelectorAll('.date');
            const editableTitles = editableTimelineContainer.querySelectorAll('h3');
            const editableParagraphs = editableTimelineContainer.querySelectorAll('p');
            
            editableDates.forEach(el => el.contentEditable = "false");
            editableTitles.forEach(el => el.contentEditable = "false");
            editableParagraphs.forEach(el => el.contentEditable = "false");
        }
        if (editableContactTitle) editableContactTitle.contentEditable = "false";
        if (editableContactDesc) editableContactDesc.contentEditable = "false";
        if (editableContactLeftTitle) editableContactLeftTitle.contentEditable = "false";
        if (editableContactLocation) editableContactLocation.contentEditable = "false";
        if (editableContactAvail) editableContactAvail.contentEditable = "false";
        if (editableContactRightTitle) editableContactRightTitle.contentEditable = "false";
        if (editablePartnersTitle) editablePartnersTitle.contentEditable = "false";
        
        if (editablePresentasiNum) editablePresentasiNum.contentEditable = "false";
        if (editablePesertaNum) editablePesertaNum.contentEditable = "false";
        
        if (saveChanges) {
            await saveAdminChanges();
        } else {
            // Restore from backup (discard unsaved changes since last save)
            editableTags.innerHTML = tempBackup.tags;
            editableName.innerText = tempBackup.name;
            editableDescription.innerText = tempBackup.description;
            editableAvatar.src = tempBackup.avatarSrc;
            
            // About Me restore
            if (editableJourneySubtitle) editableJourneySubtitle.innerHTML = tempBackup.journeySubtitle;
            if (editableAboutTopDesc) editableAboutTopDesc.innerHTML = tempBackup.aboutTopDesc;
            if (editableAboutImg) editableAboutImg.src = tempBackup.aboutImgSrc;
            if (editableJourneyInfo) editableJourneyInfo.innerHTML = tempBackup.journeyInfo;
            if (editableJourneyText) editableJourneyText.innerHTML = tempBackup.journeyText;
            if (editableExperienceGrid) editableExperienceGrid.innerHTML = tempBackup.experienceGrid;
            if (editableTimelineTitle) editableTimelineTitle.innerHTML = tempBackup.timelineTitle;
            if (editableTimelineContainer) editableTimelineContainer.innerHTML = tempBackup.timelineContainer;
            
            if (editableContactTitle) editableContactTitle.innerHTML = tempBackup.contactTitle;
            if (editableContactDesc) editableContactDesc.innerHTML = tempBackup.contactDesc;
            if (editableContactLeftTitle) editableContactLeftTitle.innerHTML = tempBackup.contactLeftTitle;
            if (editableContactLocation) editableContactLocation.innerHTML = tempBackup.contactLocation;
            if (editableContactAvail) editableContactAvail.innerHTML = tempBackup.contactAvail;
            if (editableContactRightTitle) editableContactRightTitle.innerHTML = tempBackup.contactRightTitle;
            if (editablePartnersTitle) editablePartnersTitle.innerHTML = tempBackup.partnersTitle;
            
            if (editablePresentasiNum) editablePresentasiNum.innerHTML = tempBackup.presentasiNum;
            if (editablePesertaNum) editablePesertaNum.innerHTML = tempBackup.pesertaNum;
            if (cardPhotoTesti) cardPhotoTesti.src = tempBackup.photoTesti;
            if (tempBackup.eventPhotos) {
                tempBackup.eventPhotos.forEach((src, index) => {
                    const img = document.getElementById(`event-photo-${index + 1}`);
                    if (img && src) img.src = src;
                });
            }
            
            // Restore partner logos
            if (tempBackup.partnerLogos) {
                tempBackup.partnerLogos.forEach((src, index) => {
                    const img = document.getElementById(`partner-logo-${index + 1}`);
                    if (img) {
                        img.src = src;
                    }
                });
            }
            showToast(translations[currentLang].toast_logout);
        }
        renderProjects();
        try { await signOut(auth); } catch(e) {}
    };
    
    // 8. Action Button Events
    if (saveBtn) saveBtn.addEventListener('click', saveAdminChanges);
    if (cancelBtn) cancelBtn.addEventListener('click', undoAdminChanges);
    if (logoutBtn) logoutBtn.addEventListener('click', () => exitAdminMode(false));
    
    // 7. Image Uploader Click & Change handler
    if (avatarWrapper) {
        avatarWrapper.addEventListener('click', () => {
            if (isAdminActive) {
                currentAvatarTarget = 'hero';
                avatarInput.click();
            }
        });
    }
    
    if (aboutAvatarWrapper) {
        aboutAvatarWrapper.addEventListener('click', () => {
            if (isAdminActive) {
                currentAvatarTarget = 'about';
                avatarInput.click();
            }
        });
    }

    // Event delegation for card photos to handle re-hydration on load
    document.addEventListener('click', (e) => {
        if (!isAdminActive) return;
        const wrapper1 = e.target.closest('#card-photo-wrapper-1');
        if (wrapper1) {
            currentAvatarTarget = 'card-1';
            avatarInput.click();
            return;
        }
        const wrapper2 = e.target.closest('#card-photo-wrapper-2');
        if (wrapper2) {
            currentAvatarTarget = 'card-2';
            avatarInput.click();
            return;
        }
        const wrapper3 = e.target.closest('#card-photo-wrapper-3');
        if (wrapper3) {
            currentAvatarTarget = 'card-3';
            avatarInput.click();
            return;
        }
        const wrapper4 = e.target.closest('#card-photo-wrapper-4');
        if (wrapper4) {
            currentAvatarTarget = 'card-4';
            avatarInput.click();
            return;
        }
        const wrapperTesti = e.target.closest('#card-photo-wrapper-testi');
        if (wrapperTesti) {
            currentAvatarTarget = 'card-testi';
            avatarInput.click();
            return;
        }
        for (let i = 1; i <= 6; i++) {
            const wrapperEvent = e.target.closest(`#event-photo-wrapper-${i}`);
            if (wrapperEvent) {
                currentAvatarTarget = `event-${i}`;
                avatarInput.click();
                return;
            }
        }
        
        // Partner logos click handler
        const partnerWrapper = e.target.closest('.partner-logo-wrapper');
        if (partnerWrapper) {
            activePartnerLogoImg = partnerWrapper.querySelector('.partner-logo');
            const partnerLogoInput = document.getElementById('partner-logo-input');
            if (partnerLogoInput) {
                partnerLogoInput.click();
            }
            return;
        }
    });
    
    // --- ADVANCED IMAGE CROPPER & STYLING ---
    const cropperModal = document.getElementById('cropper-modal');
    const closeCropperBtn = document.getElementById('close-cropper');
    const cropImage = document.getElementById('crop-image');
    const zoomSlider = document.getElementById('zoom-slider');
    const cropperSaveBtn = document.getElementById('cropper-save-btn');
    const cropperCancelBtn = document.getElementById('cropper-cancel-btn');
    
    let cropperState = {
        isDragging: false,
        startX: 0,
        startY: 0,
        imgX: 0,
        imgY: 0,
        imgW: 0,
        imgH: 0,
        initialW: 0,
        initialH: 0,
        zoom: 1,
        startImgX: 0,
        startImgY: 0
    };
    
    if (avatarInput) {
        avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Check size (Max 10MB because canvas cropping outputs a compact 40KB image)
                if (file.size > 10 * 1024 * 1024) {
                    showToast("Ukuran foto terlalu besar! Maksimal 10MB.", true);
                    return;
                }
                const reader = new FileReader();
                reader.onload = (event) => {
                    cropImage.src = event.target.result;
                    
                    cropImage.onload = () => {
                        const maskSize = 250;
                        const originalW = cropImage.naturalWidth;
                        const originalH = cropImage.naturalHeight;
                        
                        let initialW, initialH;
                        if (originalW > originalH) {
                            initialH = maskSize;
                            initialW = (originalW / originalH) * maskSize;
                        } else {
                            initialW = maskSize;
                            initialH = (originalH / originalW) * maskSize;
                        }
                        
                        const initialX = (maskSize - initialW) / 2;
                        const initialY = (maskSize - initialH) / 2;
                        
                        cropperState.initialW = initialW;
                        cropperState.initialH = initialH;
                        cropperState.imgW = initialW;
                        cropperState.imgH = initialH;
                        cropperState.imgX = initialX;
                        cropperState.imgY = initialY;
                        cropperState.zoom = 1;
                        
                        zoomSlider.value = 1;
                        cropImage.style.width = initialW + 'px';
                        cropImage.style.height = initialH + 'px';
                        cropImage.style.left = initialX + 'px';
                        cropImage.style.top = initialY + 'px';
                        
                        // Set crop mask shape and instruction text based on target
                        const cropArea = document.querySelector('.crop-area');
                        const cropperTitle = cropperModal.querySelector('h3');
                        const cropperDesc = cropperModal.querySelector('p');
                        if (cropArea) {
                            if (currentAvatarTarget === 'about' || currentAvatarTarget.startsWith('card-')) {
                                cropArea.classList.add('crop-rect');
                                if (currentAvatarTarget === 'about') {
                                    if (cropperTitle) cropperTitle.innerText = "Sesuaikan Foto Tentang Saya";
                                    if (cropperDesc) cropperDesc.innerText = "Geser gambar dan gunakan slider di bawah untuk menyesuaikan ukuran foto agar pas di dalam bingkai persegi.";
                                } else {
                                    if (cropperTitle) cropperTitle.innerText = "Sesuaikan Foto Sorotan Perjalanan";
                                    if (cropperDesc) cropperDesc.innerText = "Geser gambar dan gunakan slider di bawah untuk menyesuaikan ukuran foto agar pas di dalam bingkai persegi.";
                                }
                            } else {
                                cropArea.classList.remove('crop-rect');
                                if (cropperTitle) cropperTitle.innerText = "Sesuaikan Foto Profil";
                                if (cropperDesc) cropperDesc.innerText = "Geser gambar dan gunakan slider di bawah untuk menyesuaikan ukuran foto agar pas di dalam bingkai bulat.";
                            }
                        }
                        
                        cropperModal.classList.add('open');
                    };
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    const partnerLogoInput = document.getElementById('partner-logo-input');
    if (partnerLogoInput) {
        partnerLogoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.type !== 'image/png') {
                    showToast("Harap unggah logo dalam format PNG transparan!", true);
                    return;
                }
                const reader = new FileReader();
                reader.onload = (event) => {
                    const rawDataUrl = event.target.result;
                    compressImage(rawDataUrl, 300, 150, (compressedDataUrl) => {
                        if (activePartnerLogoImg) {
                            activePartnerLogoImg.src = compressedDataUrl;
                            showToast("Logo mitra diperbarui! Klik Simpan Perubahan untuk menyimpan.");
                        }
                    });
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Drag/Pan implementation
    const startDrag = (clientX, clientY) => {
        if (!cropperModal.classList.contains('open')) return;
        cropperState.isDragging = true;
        cropperState.startX = clientX;
        cropperState.startY = clientY;
        cropperState.startImgX = cropperState.imgX;
        cropperState.startImgY = cropperState.imgY;
    };
    
    const drag = (clientX, clientY) => {
        if (!cropperState.isDragging) return;
        const dx = clientX - cropperState.startX;
        const dy = clientY - cropperState.startY;
        
        cropperState.imgX = cropperState.startImgX + dx;
        cropperState.imgY = cropperState.startImgY + dy;
        
        cropImage.style.left = cropperState.imgX + 'px';
        cropImage.style.top = cropperState.imgY + 'px';
    };
    
    const stopDrag = () => {
        cropperState.isDragging = false;
    };
    
    // Event Listeners for Panning (Mouse)
    cropImage.addEventListener('mousedown', (e) => {
        e.preventDefault();
        startDrag(e.clientX, e.clientY);
    });
    
    window.addEventListener('mousemove', (e) => {
        drag(e.clientX, e.clientY);
    });
    
    window.addEventListener('mouseup', stopDrag);
    
    // Touch listeners for Mobile support
    cropImage.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });
    
    window.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
            drag(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });
    
    window.addEventListener('touchend', stopDrag);
    
    // Zoom centered implementation
    if (zoomSlider) {
        zoomSlider.addEventListener('input', () => {
            const newZoom = parseFloat(zoomSlider.value);
            const maskSize = 250;
            
            const maskCenterX = maskSize / 2;
            const maskCenterY = maskSize / 2;
            
            const centerRelX = (maskCenterX - cropperState.imgX) / cropperState.zoom;
            const centerRelY = (maskCenterY - cropperState.imgY) / cropperState.zoom;
            
            cropperState.zoom = newZoom;
            
            const newW = cropperState.initialW * newZoom;
            const newH = cropperState.initialH * newZoom;
            
            cropperState.imgX = maskCenterX - (centerRelX * newZoom);
            cropperState.imgY = maskCenterY - (centerRelY * newZoom);
            
            cropperState.imgW = newW;
            cropperState.imgH = newH;
            
            cropImage.style.width = newW + 'px';
            cropImage.style.height = newH + 'px';
            cropImage.style.left = cropperState.imgX + 'px';
            cropImage.style.top = cropperState.imgY + 'px';
        });
    }
    
    const closeCropper = () => {
        cropperModal.classList.remove('open');
        avatarInput.value = '';
    };
    
    if (closeCropperBtn) closeCropperBtn.addEventListener('click', closeCropper);
    if (cropperCancelBtn) cropperCancelBtn.addEventListener('click', closeCropper);
    
    window.addEventListener('click', (e) => {
        if (e.target === cropperModal) {
            closeCropper();
        }
    });
    
    // Export cropped image via Canvas
    if (cropperSaveBtn) {
        cropperSaveBtn.addEventListener('click', () => {
            const canvas = document.createElement('canvas');
            const targetSize = 1600; // Increased to 1600 to ensure HD output
            canvas.width = targetSize;
            canvas.height = targetSize;
            const ctx = canvas.getContext('2d');
            
            const scale = targetSize / 250; // Mask size ratio
            
            const dx = cropperState.imgX * scale;
            const dy = cropperState.imgY * scale;
            const dw = cropperState.imgW * scale;
            const dh = cropperState.imgH * scale;
            
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            ctx.drawImage(cropImage, dx, dy, dw, dh);
            
            const croppedDataUrl = canvas.toDataURL('image/png');
            
            if (currentAvatarTarget === 'hero') {
                editableAvatar.src = croppedDataUrl;
            } else if (currentAvatarTarget === 'about' && editableAboutImg) {
                editableAboutImg.src = croppedDataUrl;
            } else if (currentAvatarTarget === 'card-1') {
                const img = document.getElementById('card-photo-1');
                if (img) img.src = croppedDataUrl;
            } else if (currentAvatarTarget === 'card-2') {
                const img = document.getElementById('card-photo-2');
                if (img) img.src = croppedDataUrl;
            } else if (currentAvatarTarget === 'card-3') {
                const img = document.getElementById('card-photo-3');
                if (img) img.src = croppedDataUrl;
            } else if (currentAvatarTarget === 'card-4') {
                const img = document.getElementById('card-photo-4');
                if (img) img.src = croppedDataUrl;
            } else if (currentAvatarTarget === 'card-testi') {
                const img = document.getElementById('card-photo-testi');
                if (img) img.src = croppedDataUrl;
            } else if (currentAvatarTarget.startsWith('event-')) {
                const eventNum = currentAvatarTarget.split('-')[1];
                const img = document.getElementById(`event-photo-${eventNum}`);
                if (img) img.src = croppedDataUrl;
            }
            
            closeCropper();
            showToast("Foto disesuaikan!");
        });
    }
    
    // Helper function for premium notification toast
    function showToast(message, isError = false) {
        const existingToast = document.querySelector('.admin-toast');
        if (existingToast) existingToast.remove();
        
        const toast = document.createElement('div');
        toast.className = 'admin-toast glass';
        toast.style.cssText = `
            position: fixed;
            top: 2rem;
            right: 2rem;
            padding: 1rem 2rem;
            border-radius: 12px;
            background: ${isError ? 'rgba(239, 68, 68, 0.9)' : 'rgba(59, 130, 246, 0.9)'};
            color: #fff;
            z-index: 9999;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
            font-weight: 600;
            font-size: 0.95rem;
            transform: translateY(-20px);
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        `;
        toast.innerText = message;
        document.body.appendChild(toast);
        
        // Trigger reflow & animate in
        setTimeout(() => {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        }, 50);
        
        // Slide out and remove
        setTimeout(() => {
            toast.style.transform = 'translateY(-20px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    }
    
    // Function to update the unread messages count on the admin badge
    function updateUnreadBadge() {
        const badge = document.getElementById('admin-msg-badge');
        if (!badge) return;
        const messages = JSON.parse(appStore.getItem('portfolio_contact_messages')) || [];
        const unreadCount = messages.filter(m => m.unread).length;
        
        if (unreadCount > 0) {
            badge.innerText = unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // Contact Form submission handler with localStorage persistence & micro-interactions
    const contactForm = document.getElementById('contact-form');
    const contactSubmitBtn = document.getElementById('contact-submit-btn');
    
    if (contactForm && contactSubmitBtn) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Get values
            const nameVal = document.getElementById('form-name').value;
            const emailVal = document.getElementById('form-email').value;
            const topicVal = document.getElementById('form-topic').value;
            const messageVal = document.getElementById('form-message').value;

            // Show loading feedback state
            const originalBtnText = contactSubmitBtn.innerHTML;
            contactSubmitBtn.disabled = true;
            contactSubmitBtn.style.opacity = '0.7';
            contactSubmitBtn.innerHTML = '<span>' + translations[currentLang].msg_sending + '</span>';
            
            setTimeout(() => {
                // Generate message object
                const now = new Date();
                const dateFormatted = now.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                }) + ', ' + now.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const newMessage = {
                    id: 'msg-' + Date.now(),
                    name: nameVal,
                    email: emailVal,
                    topic: topicVal,
                    message: messageVal,
                    timestamp: now.toISOString(),
                    dateFormatted: dateFormatted,
                    unread: true
                };

                // Save to localStorage
                let messages = JSON.parse(appStore.getItem('portfolio_contact_messages')) || [];
                messages.unshift(newMessage); // Prepend to show newest first
                appStore.setItem('portfolio_contact_messages', JSON.stringify(messages));

                // Trigger premium success notification toast
                showToast(translations[currentLang].toast_message_sent);
                contactForm.reset();
                contactSubmitBtn.disabled = false;
                contactSubmitBtn.style.opacity = '1';
                contactSubmitBtn.innerHTML = originalBtnText;

                // Update unread count badge
                updateUnreadBadge();
            }, 1000);
        });
    }

    // --- TIMELINE MANAGEMENT IN ADMIN MODE ---
    const adminAddTimelineBtn = document.getElementById('admin-add-timeline-btn');
    
    function realignTimelineClasses() {
        if (!editableTimelineContainer) return;
        const items = editableTimelineContainer.querySelectorAll('.timeline-item');
        items.forEach((item, index) => {
            item.classList.remove('left', 'right');
            if (index % 2 === 0) {
                item.classList.add('left');
            } else {
                item.classList.add('right');
            }
        });
    }

    if (adminAddTimelineBtn) {
        adminAddTimelineBtn.addEventListener('click', () => {
            if (!isAdminActive) return;
            
            const newItem = document.createElement('div');
            newItem.className = `timeline-item left scroll-reveal active-reveal`;
            
            newItem.innerHTML = `
                <div class="content glass">
                    <button class="delete-timeline-btn" title="Hapus Item">🗑️</button>
                    <span class="date" contenteditable="true">${translations[currentLang].timeline_new_date}</span>
                    <h3 contenteditable="true">${translations[currentLang].timeline_new_title}</h3>
                    <p contenteditable="true">${translations[currentLang].timeline_new_desc}</p>
                </div>
            `;
            
            editableTimelineContainer.insertBefore(newItem, editableTimelineContainer.firstChild);
            
            // Realign classes to update all left/right indicators correctly starting from index 0
            realignTimelineClasses();
            
            // Scroll to the newly added item smoothly
            newItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Focus on the new position title to invite immediate editing
            const titleEl = newItem.querySelector('h3');
            if (titleEl) titleEl.focus();
        });
    }

    if (editableTimelineContainer) {
        editableTimelineContainer.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-timeline-btn');
            if (deleteBtn) {
                e.stopPropagation();
                if (confirm(translations[currentLang].confirm_delete_timeline)) {
                    const item = deleteBtn.closest('.timeline-item');
                    if (item) {
                        item.remove();
                        realignTimelineClasses();
                    }
                }
            }
        });
    }

    // --- DYNAMIC PORTFOLIO SYSTEM ---
    const projectModal = document.getElementById('project-modal');
    const closeProjectModalBtn = document.getElementById('close-project-modal');
    const addProjectForm = document.getElementById('add-project-form');
    let projectWebDataUrl = '';    // web screenshot
    let projectMobileDataUrl = ''; // mobile screenshot
    let editingProjectId = null;

    if (closeProjectModalBtn && projectModal) {
        closeProjectModalBtn.addEventListener('click', () => {
            projectModal.classList.remove('open');
            resetProjectForm();
        });
        window.addEventListener('click', (e) => {
            if (e.target === projectModal) {
                projectModal.classList.remove('open');
                resetProjectForm();
            }
        });
    }

    function compressImage(base64Str, maxWidth, maxHeight, callback) {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
            } else {
                if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            const isPng = base64Str && base64Str.startsWith('data:image/png');
            if (isPng) ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            callback(isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.75));
        };
    }

    function getDefaultPartnerLogoSvg(index) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><text x="50%" y="60%" font-family="sans-serif" font-size="20" font-weight="800" fill="white" fill-opacity="0.2" text-anchor="middle">MITRA ${index}</text></svg>`;
        return `data:image/svg+xml;base64,${btoa(svg)}`;
    }

    // --- Cover Color Palette Logic ---
    const paletteSwatches = document.querySelectorAll('.palette-swatch');
    const coverColorInput = document.getElementById('project-cover-color');
    paletteSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            paletteSwatches.forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            if (coverColorInput) coverColorInput.value = swatch.getAttribute('data-color');
        });
    });

    // --- Web Screenshot Upload ---
    const webPreviewBox = document.getElementById('web-preview-box');
    const webInput = document.getElementById('project-web-input');
    const webPreview = document.getElementById('web-screenshot-preview');
    const webPlaceholder = document.getElementById('web-upload-placeholder');

    if (webPreviewBox && webInput) {
        webPreviewBox.addEventListener('click', () => webInput.click());
        webInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                compressImage(ev.target.result, 900, 600, (url) => {
                    projectWebDataUrl = url;
                    if (webPreview) { webPreview.src = url; webPreview.style.display = 'block'; }
                    if (webPlaceholder) webPlaceholder.style.display = 'none';
                });
            };
            reader.readAsDataURL(file);
        });
    }

    // --- Mobile Screenshot Upload ---
    const mobilePreviewBox = document.getElementById('mobile-preview-box');
    const mobileInput = document.getElementById('project-mobile-input');
    const mobilePreview = document.getElementById('mobile-screenshot-preview');
    const mobilePlaceholder = document.getElementById('mobile-upload-placeholder');

    if (mobilePreviewBox && mobileInput) {
        mobilePreviewBox.addEventListener('click', () => mobileInput.click());
        mobileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                compressImage(ev.target.result, 500, 900, (url) => {
                    projectMobileDataUrl = url;
                    if (mobilePreview) { mobilePreview.src = url; mobilePreview.style.display = 'block'; }
                    if (mobilePlaceholder) mobilePlaceholder.style.display = 'none';
                });
            };
            reader.readAsDataURL(file);
        });
    }

    // --- Project Type → Link toggle ---
    const projectTypeSelect = document.getElementById('project-type');
    const projectLinkGroup = document.getElementById('project-link-group');
    const projectLinkInput = document.getElementById('project-link');
    const projectLinkLabel = document.getElementById('project-link-label');

    if (projectTypeSelect && projectLinkGroup && projectLinkInput) {
        projectTypeSelect.addEventListener('change', () => {
            if (projectTypeSelect.value === 'design') {
                if (projectLinkLabel) projectLinkLabel.innerText = 'Link Prototipe (Opsional)';
                projectLinkInput.placeholder = 'https://figma.com/...';
                projectLinkInput.required = false;
            } else {
                if (projectLinkLabel) projectLinkLabel.innerText = 'Link Web Proyek';
                projectLinkInput.placeholder = 'https://example.com';
                projectLinkInput.required = true;
            }
        });
    }

    // --- Form Submit ---
    if (addProjectForm) {
        addProjectForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const type = document.getElementById('project-type').value;
            const name = document.getElementById('project-name').value;
            const link = document.getElementById('project-link').value || '';
            const keywordsEl = document.getElementById('project-keywords');
            const keywords = keywordsEl ? keywordsEl.value : '';
            const coverColorEl = document.getElementById('project-cover-color');
            const coverColor = coverColorEl ? coverColorEl.value : '#0f2035';

            let projects = getProjectsForLang(currentLang);

            if (editingProjectId) {
                const idx = projects.findIndex(p => p.id === editingProjectId);
                if (idx !== -1) {
                    projects[idx].type = type;
                    projects[idx].name = name;
                    projects[idx].keywords = keywords;
                    projects[idx].coverColor = coverColor;
                    projects[idx].link = link;
                    projects[idx].webScreenshot = projectWebDataUrl || '';
                    projects[idx].mobileScreenshot = projectMobileDataUrl || '';
                    
                    appStore.setItem(getStorageKey('portfolio_dynamic_projects', currentLang), JSON.stringify(projects));
                    showToast(translations[currentLang].toast_project_updated);
                }
            } else {
                const newProject = {
                    id: Date.now().toString(),
                    type,
                    name,
                    keywords,
                    coverColor,
                    link,
                    webScreenshot: projectWebDataUrl || '',
                    mobileScreenshot: projectMobileDataUrl || ''
                };
                projects.push(newProject);
                appStore.setItem(getStorageKey('portfolio_dynamic_projects', currentLang), JSON.stringify(projects));
                showToast(translations[currentLang].toast_project_added);
            }

            if (projectModal) projectModal.classList.remove('open');
            resetProjectForm();
            renderProjects();
        });
    }

    function resetProjectForm() {
        if (addProjectForm) addProjectForm.reset();
        editingProjectId = null;
        const modalTitle = document.querySelector('#project-modal h3');
        if (modalTitle) modalTitle.innerText = 'Tambah Proyek Baru';
        const submitBtn = document.querySelector('#add-project-form button[type="submit"]');
        if (submitBtn) submitBtn.innerText = 'Tambah Proyek';

        projectWebDataUrl = '';
        projectMobileDataUrl = '';
        if (webPreview) { webPreview.src = ''; webPreview.style.display = 'none'; }
        if (webPlaceholder) webPlaceholder.style.display = 'block';
        if (webInput) webInput.value = '';
        if (mobilePreview) { mobilePreview.src = ''; mobilePreview.style.display = 'none'; }
        if (mobilePlaceholder) mobilePlaceholder.style.display = 'block';
        if (mobileInput) mobileInput.value = '';
        if (projectTypeSelect) projectTypeSelect.value = 'web';
        if (projectLinkLabel) projectLinkLabel.innerText = 'Link Web Proyek';
        if (projectLinkInput) { projectLinkInput.placeholder = 'https://example.com'; projectLinkInput.required = true; }
        const keywordsEl = document.getElementById('project-keywords');
        if (keywordsEl) keywordsEl.value = '';
        // Reset palette
        const swatches = document.querySelectorAll('.palette-swatch');
        swatches.forEach((s, i) => s.classList.toggle('active', i === 0));
        const ccEl = document.getElementById('project-cover-color');
        if (ccEl) ccEl.value = '#0f2035';
    }

    function openEditProjectModal(projectId) {
        const projects = getProjectsForLang(currentLang);
        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        editingProjectId = projectId;
        
        // Update modal texts
        const modalTitle = document.querySelector('#project-modal h3');
        if (modalTitle) modalTitle.innerText = 'Edit Detail Proyek';
        const submitBtn = document.querySelector('#add-project-form button[type="submit"]');
        if (submitBtn) submitBtn.innerText = 'Simpan Perubahan';

        // Pre-populate fields
        if (projectTypeSelect) {
            projectTypeSelect.value = project.type || 'web';
            projectTypeSelect.dispatchEvent(new Event('change'));
        }

        const nameEl = document.getElementById('project-name');
        if (nameEl) nameEl.value = project.name || '';

        const linkEl = document.getElementById('project-link');
        if (linkEl) linkEl.value = project.link || '';

        const keywordsEl = document.getElementById('project-keywords');
        if (keywordsEl) keywordsEl.value = project.keywords || '';

        const coverColorEl = document.getElementById('project-cover-color');
        const coverColor = project.coverColor || '#0f2035';
        if (coverColorEl) coverColorEl.value = coverColor;

        // Highlight matching swatch
        const swatches = document.querySelectorAll('.palette-swatch');
        swatches.forEach(s => {
            const isMatch = s.getAttribute('data-color') === coverColor;
            s.classList.toggle('active', isMatch);
        });

        // Set previews
        projectWebDataUrl = project.webScreenshot || '';
        if (projectWebDataUrl) {
            if (webPreview) { webPreview.src = projectWebDataUrl; webPreview.style.display = 'block'; }
            if (webPlaceholder) webPlaceholder.style.display = 'none';
        } else {
            if (webPreview) { webPreview.src = ''; webPreview.style.display = 'none'; }
            if (webPlaceholder) webPlaceholder.style.display = 'block';
        }

        projectMobileDataUrl = project.mobileScreenshot || '';
        if (projectMobileDataUrl) {
            if (mobilePreview) { mobilePreview.src = projectMobileDataUrl; mobilePreview.style.display = 'block'; }
            if (mobilePlaceholder) mobilePlaceholder.style.display = 'none';
        } else {
            if (mobilePreview) { mobilePreview.src = ''; mobilePreview.style.display = 'none'; }
            if (mobilePlaceholder) mobilePlaceholder.style.display = 'block';
        }

        // Open modal
        if (projectModal) projectModal.classList.add('open');
    }

    function reorderProjects(draggedId, targetId) {
        let projects = getProjectsForLang(currentLang);
        const draggedIdx = projects.findIndex(p => p.id === draggedId);
        const targetIdx = projects.findIndex(p => p.id === targetId);
        if (draggedIdx !== -1 && targetIdx !== -1) {
            // Remove dragged item
            const [draggedProject] = projects.splice(draggedIdx, 1);
            // Re-find target index
            const newTargetIdx = projects.findIndex(p => p.id === targetId);
            // Insert it
            projects.splice(newTargetIdx, 0, draggedProject);
            appStore.setItem(getStorageKey('portfolio_dynamic_projects', currentLang), JSON.stringify(projects));
            renderProjects();
            showToast(translations[currentLang].toast_drag_order);
        }
    }
    
    function renderProjects() {
        const portfolioGrid = document.querySelector('.portfolio-grid');
        if (!portfolioGrid) return;
        portfolioGrid.innerHTML = '';

        let projects = getProjectsForLang(currentLang);

        projects.forEach(project => {
            const card = document.createElement('div');
            const isDesign = project.type === 'design';
            card.className = 'portfolio-item portfolio-card-new glass scroll-reveal';
            if (isDesign) card.classList.add('design-item');
            card.setAttribute('data-id', project.id);
            card.setAttribute('data-type', project.type || 'web');

            const coverColor = project.coverColor || '#0f2035';
            const typeLabel = isDesign ? 'UI/UX Design' : 'Frontend Web Dev';
            const typeClass = isDesign ? 'badge-design' : 'badge-web';

            const keywordsText = (project.keywords || '')
                .split(',')
                .map(k => k.trim())
                .filter(k => k.length > 0)
                .join(', ');

            const webSrc = project.webScreenshot || '';
            const mobileSrc = project.mobileScreenshot || '';

            // Web screenshot layer
            const webLayerHtml = webSrc
                ? `<div class="proj-web-layer"><img src="${webSrc}" alt="${project.name} web" class="proj-web-img"></div>`
                : `<div class="proj-web-layer proj-placeholder-web"><span>🖥️</span></div>`;

            // Mobile phone frame layer (Always show frame, fall back to clean dark gradient screen if empty)
            const mobileImgHtml = mobileSrc
                ? `<img src="${mobileSrc}" alt="${project.name} mobile" class="proj-mobile-img">`
                : `<div class="phone-screen-placeholder"><span>📱</span></div>`;

            const mobileLayerHtml = `
                <div class="proj-phone-layer">
                    <div class="phone-frame">
                        <div class="phone-notch"></div>
                        <div class="phone-screen">
                            ${mobileImgHtml}
                        </div>
                        <div class="phone-home"></div>
                    </div>
                </div>
            `;

            // Admin color picker (palette swatches inline)
            let adminOverlayHtml = '';
            if (isAdminActive) {
                const paletteColors = ['#2563eb','#7c3aed','#059669','#dc2626','#ea580c','#0891b2','#4f46e5','#db2777'];
                const swatchesHtml = paletteColors.map(c =>
                    `<button class="card-palette-swatch${c === coverColor ? ' active' : ''}" data-color="${c}" style="background:${c};" onclick="event.stopPropagation()"></button>`
                ).join('');
                adminOverlayHtml = `
                    <div class="card-admin-overlay" onclick="event.stopPropagation()">
                        <div class="card-palette-row">${swatchesHtml}</div>
                    </div>
                `;
            }

            let adminActionsHtml = isAdminActive
                ? `<div class="card-admin-actions">
                    <button class="edit-project-btn" data-id="${project.id}" title="Edit Proyek">✏️</button>
                    <button class="delete-project-btn" data-id="${project.id}" title="Hapus Proyek">🗑️</button>
                   </div>`
                : '';

            let visitBtnHtml = '';
            if (project.link) {
                const btnLabel = isDesign 
                    ? (translations[currentLang].nav_portfolio === '作品集' ? '打开原型 ↗' : (translations[currentLang].nav_portfolio === 'Portfolio' ? 'Open Prototype ↗' : 'Buka Prototipe ↗'))
                    : (translations[currentLang].nav_portfolio === '作品集' ? '访问网站 ↗' : (translations[currentLang].nav_portfolio === 'Portfolio' ? 'Visit Site ↗' : 'Kunjungi Situs ↗'));
                visitBtnHtml = `<a href="${project.link}" target="_blank" class="proj-visit-btn" onclick="event.stopPropagation()">${btnLabel}</a>`;
            }

            card.innerHTML = `
                ${adminActionsHtml}
                <div class="proj-cover" style="background-color: ${coverColor};">
                    ${adminOverlayHtml}
                    ${webLayerHtml}
                    ${mobileLayerHtml}
                </div>
                <div class="proj-info">
                    <div class="proj-info-left">
                        <h3 class="proj-name">${project.name}</h3>
                        <div class="proj-keywords">${keywordsText}</div>
                    </div>
                    <div class="proj-info-right">
                        <span class="proj-type-badge ${typeClass}">${typeLabel}</span>
                        ${visitBtnHtml}
                    </div>
                </div>
            `;

            // Card click → lightbox
            card.addEventListener('click', (e) => {
                if (e.target.closest('.delete-project-btn')) return;
                if (e.target.closest('.edit-project-btn')) return;
                if (e.target.closest('.proj-visit-btn')) return;
                if (e.target.closest('.card-admin-overlay')) return;
                if (isAdminActive) return;
                openLightbox(project.id);
            });

            if (isAdminActive) {
                card.setAttribute('draggable', 'true');
                
                card.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', project.id);
                    card.classList.add('dragging');
                });
                
                card.addEventListener('dragend', () => {
                    card.classList.remove('dragging');
                    const allCards = document.querySelectorAll('.portfolio-item');
                    allCards.forEach(c => c.classList.remove('drag-over'));
                });
                
                card.addEventListener('dragover', (e) => {
                    if (card.classList.contains('add-project-card')) return;
                    e.preventDefault();
                    card.classList.add('drag-over');
                });
                
                card.addEventListener('dragleave', () => {
                    card.classList.remove('drag-over');
                });
                
                card.addEventListener('drop', (e) => {
                    e.preventDefault();
                    card.classList.remove('drag-over');
                    const draggedId = e.dataTransfer.getData('text/plain');
                    const targetId = project.id;
                    if (draggedId && draggedId !== targetId) {
                        reorderProjects(draggedId, targetId);
                    }
                });

                // Attach click handler for edit button
                const editBtn = card.querySelector('.edit-project-btn');
                if (editBtn) {
                    editBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openEditProjectModal(project.id);
                    });
                }
            }

            // Admin palette swatches on card
            const cardSwatches = card.querySelectorAll('.card-palette-swatch');
            cardSwatches.forEach(swatch => {
                swatch.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const newColor = swatch.getAttribute('data-color');
                    const coverEl = card.querySelector('.proj-cover');
                    if (coverEl) coverEl.style.backgroundColor = newColor;
                    cardSwatches.forEach(s => s.classList.remove('active'));
                    swatch.classList.add('active');
                    let savedProjects = getProjectsForLang(currentLang);
                    const idx = savedProjects.findIndex(p => p.id === project.id);
                    if (idx !== -1) {
                        savedProjects[idx].coverColor = newColor;
                        appStore.setItem(getStorageKey('portfolio_dynamic_projects', currentLang), JSON.stringify(savedProjects));
                        project.coverColor = newColor;
                    }
                });
            });

            // Delete btn
            const deleteBtn = card.querySelector('.delete-project-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = deleteBtn.getAttribute('data-id');
                    if (confirm(translations[currentLang].confirm_delete_project)) {
                        let currentProjects = getProjectsForLang(currentLang);
                        currentProjects = currentProjects.filter(p => p.id !== id);
                        appStore.setItem(getStorageKey('portfolio_dynamic_projects', currentLang), JSON.stringify(currentProjects));
                        renderProjects();
                        showToast(translations[currentLang].toast_project_deleted);
                    }
                });
            }

            portfolioGrid.appendChild(card);
            if (typeof revealObserver !== 'undefined' && revealObserver.observe) {
                revealObserver.observe(card);
            }
        });

        // Add card (admin)
        if (isAdminActive) {
            const addCard = document.createElement('div');
            addCard.className = 'portfolio-item portfolio-card-new glass add-project-card';
            const addProjectText = translations[currentLang].project_modal_title;
            const clickToAddText = translations[currentLang].nav_portfolio === '作品集' ? '点击添加新项目' : (translations[currentLang].nav_portfolio === 'Portfolio' ? 'Click to add a new project' : 'Klik untuk menambahkan proyek baru');
            addCard.innerHTML = `
                <div class="proj-cover" style="background: rgba(59,130,246,0.05); border: 2px dashed rgba(59,130,246,0.35); display:flex; justify-content:center; align-items:center; flex-direction:column; gap:0.5rem;">
                    <div style="font-size: 2.5rem; color: var(--accent-color);">➕</div>
                    <span style="font-weight:600; font-size:0.9rem; color:rgba(255,255,255,0.6);">${addProjectText}</span>
                </div>
                <div class="proj-info" style="justify-content:center; padding: 1rem 1.6rem;">
                    <span style="font-weight:600; font-size:0.95rem; color:rgba(255,255,255,0.6);">${clickToAddText}</span>
                </div>
            `;
            addCard.addEventListener('click', () => {
                if (projectModal) projectModal.classList.add('open');
            });
            portfolioGrid.appendChild(addCard);
        }

        // Re-apply active filter
        const activeFilter = document.querySelector('.filter-btn.active');
        if (activeFilter) filterProjects(activeFilter.getAttribute('data-filter'));
    }

    // --- ADMIN MESSAGES INBOX FUNCTIONALITY ---


    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    // Render list of messages in sidebar
    function renderMessageList(filterText = '') {
        if (!msgListContainer) return;
        
        msgListContainer.innerHTML = '';
        const messages = JSON.parse(appStore.getItem('portfolio_contact_messages')) || [];
        
        // Filter messages
        const query = filterText.toLowerCase().trim();
        const filteredMessages = messages.filter(msg => {
            return (msg.name && msg.name.toLowerCase().includes(query)) || 
                   (msg.topic && msg.topic.toLowerCase().includes(query)) ||
                   (msg.message && msg.message.toLowerCase().includes(query));
        });

        if (filteredMessages.length === 0) {
            const notFoundText = translations[currentLang].admin_msg_not_found;
            const emptyText = translations[currentLang].admin_msg_inbox_empty;
            msgListContainer.innerHTML = `
                <div style="text-align: center; color: rgba(255,255,255,0.4); padding: 2rem 0; font-size: 0.9rem;">
                  ${filterText ? notFoundText : emptyText}
                </div>
            `;
            return;
        }

        filteredMessages.forEach(msg => {
            const item = document.createElement('div');
            item.className = 'msg-item';
            if (msg.id === activeMessageId) item.classList.add('active-msg');
            if (msg.unread) item.classList.add('unread-msg');

            const initial = msg.name ? msg.name.charAt(0) : 'U';
            
            // Generate message excerpt (first 50 chars)
            const excerpt = msg.message && msg.message.length > 50 ? msg.message.substring(0, 47) + '...' : (msg.message || '');

            item.innerHTML = `
                <div class="msg-item-avatar">${escapeHTML(initial)}</div>
                <div class="msg-item-content">
                  <div class="msg-item-header">
                    <span class="msg-item-name">${escapeHTML(msg.name || '')}</span>
                    <span class="msg-item-date">${escapeHTML((msg.dateFormatted || '').split(',')[0])}</span>
                  </div>
                  <div class="msg-item-topic">${escapeHTML(msg.topic || '')}</div>
                  <div class="msg-item-excerpt">${escapeHTML(excerpt)}</div>
                </div>
            `;

            item.addEventListener('click', () => {
                selectMessage(msg.id);
            });

            msgListContainer.appendChild(item);
        });
    }

    // Select and display a message in details view
    function selectMessage(messageId) {
        let messages = JSON.parse(appStore.getItem('portfolio_contact_messages')) || [];
        const msgIndex = messages.findIndex(m => m.id === messageId);
        
        if (msgIndex === -1) return;
        
        const message = messages[msgIndex];
        
        // Mark as read
        if (message.unread) {
            message.unread = false;
            messages[msgIndex] = message;
            appStore.setItem('portfolio_contact_messages', JSON.stringify(messages));
            updateUnreadBadge();
        }

        activeMessageId = messageId;
        
        // Fill in fields
        if (detailSenderAvatar) detailSenderAvatar.innerText = message.name ? message.name.charAt(0) : 'U';
        if (detailSenderName) detailSenderName.innerText = message.name || '';
        if (detailSenderEmail) {
            detailSenderEmail.innerText = message.email || '';
            detailSenderEmail.href = message.email ? `mailto:${message.email}` : '#';
        }
        if (detailMsgDate) detailMsgDate.innerText = message.dateFormatted || '';
        if (detailMsgTopic) detailMsgTopic.innerText = message.topic || '';
        if (detailMsgText) detailMsgText.innerText = message.message || '';

        // Show view, hide placeholder
        if (msgDetailPlaceholder) msgDetailPlaceholder.style.display = 'none';
        if (msgDetailView) msgDetailView.style.display = 'flex';

        // Re-render sidebar to update read styling / active styling
        renderMessageList(msgSearchInput ? msgSearchInput.value : '');
    }

    // Open/Close Messages Modal Listeners
    if (adminMessagesBtn) {
        adminMessagesBtn.addEventListener('click', () => {
            if (!isAdminActive) return;
            
            // Open modal
            if (adminMessagesModal) {
                adminMessagesModal.classList.add('open');
            }
            
            // Reset state
            activeMessageId = null;
            if (msgSearchInput) msgSearchInput.value = '';
            if (msgDetailPlaceholder) msgDetailPlaceholder.style.display = 'flex';
            if (msgDetailView) msgDetailView.style.display = 'none';
            
            // Render list
            renderMessageList();
        });
    }

    const closeMessagesModal = () => {
        if (adminMessagesModal) {
            adminMessagesModal.classList.remove('open');
        }
    };

    if (closeMessagesModalBtn) {
        closeMessagesModalBtn.addEventListener('click', closeMessagesModal);
    }

    window.addEventListener('click', (e) => {
        if (e.target === adminMessagesModal) {
            closeMessagesModal();
        }
    });

    // Search bar event
    if (msgSearchInput) {
        msgSearchInput.addEventListener('input', () => {
            renderMessageList(msgSearchInput.value);
        });
    }

    // Toggle unread button click
    if (msgToggleUnreadBtn) {
        msgToggleUnreadBtn.addEventListener('click', () => {
            if (!activeMessageId) return;
            
            let messages = JSON.parse(appStore.getItem('portfolio_contact_messages')) || [];
            const msgIndex = messages.findIndex(m => m.id === activeMessageId);
            
            if (msgIndex !== -1) {
                messages[msgIndex].unread = true;
                appStore.setItem('portfolio_contact_messages', JSON.stringify(messages));
                
                showToast(translations[currentLang].toast_message_unread);
                
                // Reset detail view and active state
                activeMessageId = null;
                if (msgDetailPlaceholder) msgDetailPlaceholder.style.display = 'flex';
                if (msgDetailView) msgDetailView.style.display = 'none';
                
                updateUnreadBadge();
                renderMessageList(msgSearchInput ? msgSearchInput.value : '');
            }
        });
    }

    // Delete message button click
    if (msgDeleteBtn) {
        msgDeleteBtn.addEventListener('click', () => {
            if (!activeMessageId) return;
            
            if (confirm(translations[currentLang].confirm_delete_message)) {
                let messages = JSON.parse(appStore.getItem('portfolio_contact_messages')) || [];
                messages = messages.filter(m => m.id !== activeMessageId);
                appStore.setItem('portfolio_contact_messages', JSON.stringify(messages));
                
                showToast(translations[currentLang].toast_message_deleted);
                
                // Reset detail view and active state
                activeMessageId = null;
                if (msgDetailPlaceholder) msgDetailPlaceholder.style.display = 'flex';
                if (msgDetailView) msgDetailView.style.display = 'none';
                
                updateUnreadBadge();
                renderMessageList(msgSearchInput ? msgSearchInput.value : '');
            }
        });
    }

    // --- PORTFOLIO CATEGORY FILTER JS LOGIC ---
    function filterProjects(category) {
        const cards = document.querySelectorAll('.portfolio-grid .portfolio-item');
        
        cards.forEach(card => {
            if (card.classList.contains('add-project-card')) return;
            
            const projectType = card.getAttribute('data-type') || 'web';
            if (category === 'all' || projectType === category) {
                card.classList.remove('filtered-out');
            } else {
                card.classList.add('filtered-out');
            }
        });
    }

    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterProjects(btn.getAttribute('data-filter'));
        });
    });

    // --- ABOUT TABS SWITCHER JS LOGIC ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active-content'));
            
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            const targetContent = document.getElementById(tabId);
            if (targetContent) {
                targetContent.classList.add('active-content');
                observeElements();
            }
        });
    });

    // --- LIGHTBOX MODAL JS LOGIC ---
    let currentLightboxIndex = 0;
    let lightboxProjects = [];

    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxTitle = document.getElementById('lightbox-title');
    const lightboxDesc = document.getElementById('lightbox-desc');
    const closeLightboxBtn = document.getElementById('close-lightbox');
    const lightboxPrevBtn = document.getElementById('lightbox-prev');
    const lightboxNextBtn = document.getElementById('lightbox-next');

    function openLightbox(projectId) {
        const projectsData = getProjectsForLang(currentLang);
        
        const activeFilterBtn = document.querySelector('.filter-btn.active');
        const activeFilter = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'all';
        
        if (activeFilter === 'all') {
            lightboxProjects = projectsData;
        } else {
            lightboxProjects = projectsData.filter(p => p.type === activeFilter);
        }
        
        currentLightboxIndex = lightboxProjects.findIndex(p => p.id === projectId);
        if (currentLightboxIndex === -1) return;
        
        updateLightboxContent();
        if (lightboxModal) lightboxModal.classList.add('open');
    }

    function updateLightboxContent() {
        const project = lightboxProjects[currentLightboxIndex];
        if (!project) return;
        
        const container = document.querySelector('.lightbox-image-container');
        if (container) {
            // Remove everything except the navigation arrows (.lightbox-arrow)
            const elementsToRemove = container.querySelectorAll(':not(.lightbox-arrow)');
            elementsToRemove.forEach(el => el.remove());
            
            const webSrc = project.webScreenshot || '';
            const mobileSrc = project.mobileScreenshot || '';
            
            if (webSrc && mobileSrc) {
                // Dual view layout
                const dualDiv = document.createElement('div');
                dualDiv.className = 'lightbox-dual-views';
                dualDiv.innerHTML = `
                    <div class="lightbox-web-wrapper">
                        <img src="${webSrc}" alt="${project.name} Web">
                    </div>
                    <div class="lightbox-mobile-wrapper">
                        <div class="phone-frame">
                            <div class="phone-notch"></div>
                            <div class="phone-screen">
                                <img src="${mobileSrc}" alt="${project.name} Mobile">
                            </div>
                            <div class="phone-home"></div>
                        </div>
                    </div>
                `;
                container.appendChild(dualDiv);
            } else if (webSrc) {
                // Web screenshot only
                const webImg = document.createElement('img');
                webImg.id = 'lightbox-img';
                webImg.src = webSrc;
                webImg.style.cssText = 'max-width: 100%; max-height: 70vh; object-fit: contain;';
                webImg.alt = `${project.name} Web`;
                container.appendChild(webImg);
            } else if (mobileSrc) {
                // Mobile screenshot only (phone frame)
                const mobileDiv = document.createElement('div');
                mobileDiv.className = 'lightbox-single-mobile-container';
                mobileDiv.innerHTML = `
                    <div class="phone-frame">
                        <div class="phone-notch"></div>
                        <div class="phone-screen">
                            <img src="${mobileSrc}" alt="${project.name} Mobile">
                        </div>
                        <div class="phone-home"></div>
                    </div>
                `;
                container.appendChild(mobileDiv);
            } else {
                // Empty fallback
                const fallback = document.createElement('div');
                fallback.style.cssText = 'color: rgba(255,255,255,0.3); font-size: 1.2rem; padding: 3rem;';
                fallback.innerText = translations[currentLang].lightbox_no_preview;
                container.appendChild(fallback);
            }
        }

        if (lightboxTitle) lightboxTitle.innerText = project.name;
        if (lightboxDesc) {
            const typeLabel = project.type === 'design' ? 'UI/UX Design' : 'Frontend Web Dev';
            const keywordsHtml = (project.keywords || '')
                .split(',')
                .map(k => k.trim())
                .filter(k => k.length > 0)
                .map(k => `#${k}`)
                .join(' ');
            lightboxDesc.innerText = `${typeLabel} ${keywordsHtml ? '· ' + keywordsHtml : ''}`;
        }
        
        const linkWrapper = document.getElementById('lightbox-link-wrapper');
        if (linkWrapper) {
            if (project.link) {
                const btnLabel = project.type === 'design' 
                    ? (translations[currentLang].nav_portfolio === '作品集' ? '打开原型 ↗' : (translations[currentLang].nav_portfolio === 'Portfolio' ? 'Open Prototype ↗' : 'Buka Prototipe ↗'))
                    : (translations[currentLang].nav_portfolio === '作品集' ? '访问网站 ↗' : (translations[currentLang].nav_portfolio === 'Portfolio' ? 'Visit Site ↗' : 'Kunjungi Situs ↗'));
                linkWrapper.innerHTML = `<a href="${project.link}" target="_blank" class="btn btn-primary btn-sm" style="border-radius: 8px; padding: 0.6rem 1.2rem; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none;">${btnLabel}</a>`;
            } else {
                linkWrapper.innerHTML = '';
            }
        }
        
        if (lightboxProjects.length <= 1) {
            if (lightboxPrevBtn) lightboxPrevBtn.style.display = 'none';
            if (lightboxNextBtn) lightboxNextBtn.style.display = 'none';
        } else {
            if (lightboxPrevBtn) lightboxPrevBtn.style.display = 'flex';
            if (lightboxNextBtn) lightboxNextBtn.style.display = 'flex';
        }
    }

    if (closeLightboxBtn) {
        closeLightboxBtn.addEventListener('click', () => {
            if (lightboxModal) lightboxModal.classList.remove('open');
        });
    }

    if (lightboxModal) {
        lightboxModal.addEventListener('click', (e) => {
            if (e.target === lightboxModal) {
                lightboxModal.classList.remove('open');
            }
        });
    }

    if (lightboxPrevBtn) {
        lightboxPrevBtn.addEventListener('click', () => {
            if (lightboxProjects.length > 1) {
                currentLightboxIndex = (currentLightboxIndex - 1 + lightboxProjects.length) % lightboxProjects.length;
                updateLightboxContent();
            }
        });
    }

    if (lightboxNextBtn) {
        lightboxNextBtn.addEventListener('click', () => {
            if (lightboxProjects.length > 1) {
                currentLightboxIndex = (currentLightboxIndex + 1) % lightboxProjects.length;
                updateLightboxContent();
            }
        });
    }

    window.addEventListener('keydown', (e) => {
        if (!lightboxModal || !lightboxModal.classList.contains('open')) return;
        if (e.key === 'Escape') {
            lightboxModal.classList.remove('open');
        } else if (e.key === 'ArrowLeft') {
            if (lightboxProjects.length > 1) {
                currentLightboxIndex = (currentLightboxIndex - 1 + lightboxProjects.length) % lightboxProjects.length;
                updateLightboxContent();
            }
        } else if (e.key === 'ArrowRight') {
            if (lightboxProjects.length > 1) {
                currentLightboxIndex = (currentLightboxIndex + 1) % lightboxProjects.length;
                updateLightboxContent();
            }
        }
    });
});
