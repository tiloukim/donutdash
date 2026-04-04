// Shop owner portal bilingual support: English + Khmer

export type ShopLang = 'en' | 'km'

const translations = {
  // Layout & Navigation
  'nav.dashboard': { en: 'Dashboard', km: 'ផ្ទាំងគ្រប់គ្រង' },
  'nav.orders': { en: 'Orders', km: 'ការបញ្ជាទិញ' },
  'nav.menu': { en: 'Menu', km: 'មុខម្ហូប' },
  'nav.analytics': { en: 'Analytics', km: 'ការវិភាគ' },
  'nav.hours': { en: 'Hours', km: 'ម៉ោងបើក' },
  'nav.referral': { en: 'Referral', km: 'ការណែនាំ' },
  'nav.support': { en: 'Support', km: 'ជំនួយ' },
  'nav.issues': { en: 'Issues', km: 'បញ្ហា' },
  'nav.documents': { en: 'Documents', km: 'ឯកសារ' },
  'nav.settings': { en: 'Settings', km: 'ការកំណត់' },
  'nav.signOut': { en: 'Sign Out', km: 'ចាកចេញ' },

  // Dashboard
  'dash.totalSales': { en: 'Total Sales', km: 'ការលក់សរុប' },
  'dash.yourEarnings': { en: 'Your Earnings', km: 'ចំណូលរបស់អ្នក' },
  'dash.commission': { en: 'Commission Paid', km: 'កម្រៃជើងសា' },
  'dash.orders': { en: 'Orders', km: 'ការបញ្ជាទិញ' },
  'dash.today': { en: 'Today', km: 'ថ្ងៃនេះ' },
  'dash.thisWeek': { en: 'This Week', km: 'សប្ដាហ៍នេះ' },
  'dash.thisMonth': { en: 'This Month', km: 'ខែនេះ' },
  'dash.allTime': { en: 'All Time', km: 'សរុបទាំងអស់' },
  'dash.pendingOrders': { en: 'Pending Orders', km: 'ការបញ្ជាទិញរង់ចាំ' },
  'dash.recentOrders': { en: 'Recent Orders', km: 'ការបញ្ជាទិញថ្មីៗ' },
  'dash.referralCode': { en: 'Your Referral Code', km: 'លេខកូដណែនាំរបស់អ្នក' },
  'dash.copy': { en: 'Copy', km: 'ចម្លង' },
  'dash.copied': { en: 'Copied!', km: 'បានចម្លង!' },

  // Orders
  'orders.all': { en: 'All', km: 'ទាំងអស់' },
  'orders.pending': { en: 'Pending', km: 'រង់ចាំ' },
  'orders.confirmed': { en: 'Confirmed', km: 'បានបញ្ជាក់' },
  'orders.preparing': { en: 'Preparing', km: 'កំពុងរៀបចំ' },
  'orders.ready': { en: 'Ready for Pickup', km: 'រួចរាល់ទទួល' },
  'orders.delivered': { en: 'Delivered', km: 'បានដឹកជញ្ជូន' },
  'orders.cancelled': { en: 'Cancelled', km: 'បានបោះបង់' },
  'orders.accept': { en: 'Accept Order', km: 'ទទួលការបញ្ជាទិញ' },
  'orders.reject': { en: 'Reject', km: 'បដិសេធ' },
  'orders.startPreparing': { en: 'Start Preparing', km: 'ចាប់ផ្ដើមរៀបចំ' },
  'orders.readyForPickup': { en: 'Ready for Pickup', km: 'រួចរាល់សម្រាប់ទទួល' },
  'orders.customer': { en: 'Customer', km: 'អតិថិជន' },
  'orders.items': { en: 'Items', km: 'មុខទំនិញ' },
  'orders.subtotal': { en: 'Subtotal', km: 'សរុបរង' },
  'orders.yourEarnings': { en: 'Your Earnings', km: 'ចំណូលរបស់អ្នក' },
  'orders.deliveryAddress': { en: 'Delivery Address', km: 'អាសយដ្ឋានដឹកជញ្ជូន' },
  'orders.scheduled': { en: 'Scheduled', km: 'បានកំណត់ពេល' },
  'orders.soundAlerts': { en: 'Sound Alerts', km: 'សំឡេងជូនដំណឹង' },
  'orders.newOrders': { en: 'new orders need attention', km: 'ការបញ្ជាទិញថ្មីត្រូវការ​ចាត់ការ' },

  // Menu
  'menu.addItem': { en: '+ Add Item', km: '+ បន្ថែមម៉ុខម្ហូប' },
  'menu.editItem': { en: 'Edit Item', km: 'កែម៉ុខម្ហូប' },
  'menu.newItem': { en: 'New Item', km: 'ម៉ុខម្ហូបថ្មី' },
  'menu.name': { en: 'Name', km: 'ឈ្មោះ' },
  'menu.price': { en: 'Price ($)', km: 'តម្លៃ ($)' },
  'menu.description': { en: 'Description', km: 'ការពិពណ៌នា' },
  'menu.category': { en: 'Category', km: 'ប្រភេទ' },
  'menu.prepTime': { en: 'Prep Time (min)', km: 'រយៈពេលរៀបចំ (នាទី)' },
  'menu.available': { en: 'Available', km: 'មាន' },
  'menu.featured': { en: 'Featured', km: 'ពិសេស' },
  'menu.save': { en: 'Save', km: 'រក្សាទុក' },
  'menu.cancel': { en: 'Cancel', km: 'បោះបង់' },
  'menu.delete': { en: 'Delete this item?', km: 'លុបម៉ុខម្ហូបនេះ?' },
  'menu.variants': { en: 'Variants', km: 'ជម្រើស' },
  'menu.addVariantGroup': { en: '+ Add variant group', km: '+ បន្ថែមជម្រើស' },
  'menu.addOption': { en: '+ Add option', km: '+ បន្ថែមជម្រើសរង' },
  'menu.images': { en: 'Images', km: 'រូបភាព' },
  'menu.uploadImages': { en: 'Upload Images', km: 'បង្ហោះរូបភាព' },
  'menu.uploading': { en: 'Uploading...', km: 'កំពុងបង្ហោះ...' },
  'menu.on': { en: 'On', km: 'បើក' },
  'menu.off': { en: 'Off', km: 'បិទ' },
  'menu.soldOut': { en: 'Sold Out', km: 'អស់ហើយ' },
  'menu.inStock': { en: 'In Stock', km: 'នៅមាន' },
  'menu.emptyTitle': { en: 'Your menu is empty', km: 'មុខម្ហូបរបស់អ្នកទទេ' },
  'menu.emptyDesc': { en: "Get started quickly by loading our starter template with common donut shop items. You'll need to set your own prices, upload photos, and turn items on when ready.", km: 'ចាប់ផ្ដើមយ៉ាងរហ័សដោយផ្ទុកពុម្ពចាប់ផ្ដើមជាមួយម៉ុខម្ហូបហាងដូណាត់ទូទៅ។ អ្នកត្រូវកំណត់តម្លៃ បង្ហោះរូបថត និងបើកម៉ុខម្ហូបនៅពេលរួចរាល់។' },
  'menu.loadStarter': { en: 'Load Starter Menu', km: 'ផ្ទុកមុខម្ហូបគំរូ' },
  'menu.fromScratch': { en: 'Add From Scratch', km: 'បន្ថែមដោយខ្លួនឯង' },

  // Hours
  'hours.title': { en: 'Business Hours', km: 'ម៉ោងបើកហាង' },
  'hours.save': { en: 'Save Hours', km: 'រក្សាទុកម៉ោង' },
  'hours.saving': { en: 'Saving...', km: 'កំពុងរក្សាទុក...' },
  'hours.closed': { en: 'Closed', km: 'បិទ' },
  'hours.sunday': { en: 'Sunday', km: 'អាទិត្យ' },
  'hours.monday': { en: 'Monday', km: 'ចន្ទ' },
  'hours.tuesday': { en: 'Tuesday', km: 'អង្គារ' },
  'hours.wednesday': { en: 'Wednesday', km: 'ពុធ' },
  'hours.thursday': { en: 'Thursday', km: 'ព្រហស្បតិ៍' },
  'hours.friday': { en: 'Friday', km: 'សុក្រ' },
  'hours.saturday': { en: 'Saturday', km: 'សៅរ៍' },

  // Analytics
  'analytics.totalOrders': { en: 'Total Orders', km: 'ការបញ្ជាទិញសរុប' },
  'analytics.totalRevenue': { en: 'Total Revenue', km: 'ចំណូលសរុប' },
  'analytics.avgOrderValue': { en: 'Avg Order Value', km: 'តម្លៃមធ្យមក្នុងការបញ្ជាទិញ' },
  'analytics.totalCustomers': { en: 'Total Customers', km: 'អតិថិជនសរុប' },
  'analytics.repeatRate': { en: 'Repeat Customer %', km: 'ភាគរយអតិថិជនត្រឡប់មកវិញ' },
  'analytics.popularItems': { en: 'Popular Items', km: 'ម៉ុខម្ហូបពេញនិយម' },
  'analytics.peakHours': { en: 'Peak Hours', km: 'ម៉ោងកំពូល' },
  'analytics.dailyTrend': { en: 'Daily Trend (Last 30 Days)', km: 'និន្នាការប្រចាំថ្ងៃ (៣០ថ្ងៃចុងក្រោយ)' },

  // Settings
  'settings.shopProfile': { en: 'Shop Profile', km: 'ព័ត៌មានហាង' },
  'settings.shopName': { en: 'Shop Name', km: 'ឈ្មោះហាង' },
  'settings.description': { en: 'Description', km: 'ការពិពណ៌នា' },
  'settings.address': { en: 'Street Address', km: 'អាសយដ្ឋាន' },
  'settings.city': { en: 'City', km: 'ក្រុង' },
  'settings.state': { en: 'State / Province', km: 'រដ្ឋ / ខេត្ត' },
  'settings.zip': { en: 'ZIP / Postal Code', km: 'លេខប្រៃសណីយ៍' },
  'settings.phone': { en: 'Shop Phone', km: 'ទូរសព្ទហាង' },
  'settings.deliveryFee': { en: 'Delivery Fee ($)', km: 'ថ្លៃដឹកជញ្ជូន ($)' },
  'settings.minOrder': { en: 'Min Order ($)', km: 'ការបញ្ជាទិញអប្បបរមា ($)' },
  'settings.serviceFee': { en: 'Service Fee %', km: 'ថ្លៃសេវា %' },
  'settings.save': { en: 'Save Changes', km: 'រក្សាទុកការផ្លាស់ប្ដូរ' },
  'settings.saving': { en: 'Saving...', km: 'កំពុងរក្សាទុក...' },
  'settings.location': { en: 'Location (GPS)', km: 'ទីតាំង (GPS)' },
  'settings.setLocation': { en: 'Set to Shop Location', km: 'កំណត់ទីតាំងហាង' },
  'settings.bankAccount': { en: 'Bank Account', km: 'គណនីធនាគារ' },
  'settings.shopImages': { en: 'Shop Images', km: 'រូបភាពហាង' },

  // Common
  'common.loading': { en: 'Loading...', km: 'កំពុងផ្ទុក...' },
  'common.error': { en: 'Error', km: 'បញ្ហា' },
  'common.success': { en: 'Success', km: 'ជោគជ័យ' },
  'common.confirm': { en: 'Confirm', km: 'បញ្ជាក់' },
  'common.language': { en: 'English', km: 'ភាសាខ្មែរ' },
} as const

export type TranslationKey = keyof typeof translations

export function t(key: TranslationKey, lang: ShopLang): string {
  return translations[key]?.[lang] || translations[key]?.en || key
}

export const SHOP_LANG_KEY = 'dd_shop_lang'
