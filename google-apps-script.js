/**
 * Google Apps Script for Enjoy The Gifts - Order Management System
 * This script handles data synchronization between the website and Google Sheets
 */

// Configuration
const SPREADSHEET_ID = '11RpIuGkByR28jHTaX8qKjSknopQylsEGb4bmwQUFM_8';
const ORDERS_SHEET_NAME = 'Orders';
const UPDATE_LOGS_SHEET_NAME = 'UpdateLogs';
const DELETE_LOGS_SHEET_NAME = 'DeleteLogs';

/**
 * Handle POST requests (form submissions or API calls)
 */
function doPost(e) {
  try {
    let data;
    
    // Parse JSON or form-data
    if (e.postData && e.postData.type === 'application/json') {
      data = JSON.parse(e.postData.contents);
    } else {
      data = e.parameter;
    }
    
    // Log received data for debugging
    console.log('Received data:', JSON.stringify(data));
    
    // Route by action
    if (data.action) {
      switch (data.action) {
        case 'createOrder':   
          return createOrder(data.data || data, data.user || 'غير محدد');
        case 'updateOrder':   
          return updateOrder(data.orderId, data.data || data, data.user || 'غير محدد');
        case 'deleteOrder':   
          return deleteOrder(data.orderId, data.user || 'غير محدد');
        case 'restoreOrder':  
          return restoreOrder(data.timestamp || data.logId, data.user || 'غير محدد');
        case 'createInvoice':
          return createInvoice(data.orderId, data.user || 'غير محدد');
        default:
          return createResponse('error', 'Unknown action: ' + data.action);
      }
    } else {
      // Legacy form submission from Enjoy.html
      return handleFormSubmission(data);
    }
  } catch (error) {
    console.error('doPost error:', error);
    return createResponse('error', 'Server error: ' + error.message);
  }
}

/**
 * Handle GET requests (data retrieval)
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === 'getOrders') return getOrders();
    if (action === 'getLogs') return getLogs();
    if (action === 'getOrder') return getOrder(e.parameter.orderId);
    
    return createResponse('error', 'Unknown action: ' + action);
  } catch (error) {
    console.error('doGet error:', error);
    return createResponse('error', 'Server error: ' + error.message);
  }
}

/**
 * Handle legacy form submission from Enjoy.html
 */
function handleFormSubmission(data) {
  try {
    const orderData = {
      'معرف الطلب': generateOrderId(),
      'وقت وتاريخ الطلب': new Date().toLocaleString('ar-EG'),
      'الاسم الكامل': data.name || '',
      'رقم الهاتف': data.phone || '',
      'المنتج': data.products || '',
      'سعر المنتجات': parseFloat(data.productPrice) || 0,
      'تكلفة الشحن': parseFloat(data.shippingCost) || 0,
      'التكلفة الإجمالية': parseFloat(data.totalCost) || 0,
      'المنطقة': data.governorate || '',
      'طريقة التوصيل': data.deliveryType || '',
      'العنوان': data.address || '',
      'رابط الموقع': data.siteLink || '',
      'حالة الطلب': 'طلب جديد',
      'تم الإنشاء بواسطة': 'النظام'
    };
    
    const sheet = getOrCreateSheet(ORDERS_SHEET_NAME);
    addOrderToSheet(sheet, orderData);
    
    return createResponse('success', 'Order created successfully', { 
      orderId: orderData['معرف الطلب'] 
    });
  } catch (error) {
    console.error('handleFormSubmission error:', error);
    return createResponse('error', 'Failed to create order: ' + error.message);
  }
}

/**
 * Create a new order via API
 */
function createOrder(orderData, user) {
  try {
    // Ensure required fields
    if (!orderData['معرف الطلب']) {
      orderData['معرف الطلب'] = generateOrderId();
    }
    
    if (!orderData['وقت وتاريخ الطلب']) {
      orderData['وقت وتاريخ الطلب'] = new Date().toLocaleString('ar-EG');
    }
    
    orderData['تم الإنشاء بواسطة'] = user || 'النظام';
    
    // Set default status if not provided
    if (!orderData['حالة الطلب']) {
      orderData['حالة الطلب'] = 'طلب جديد';
    }
    
    const sheet = getOrCreateSheet(ORDERS_SHEET_NAME);
    addOrderToSheet(sheet, orderData);
    
    return createResponse('success', 'Order created successfully', { 
      orderId: orderData['معرف الطلب'] 
    });
  } catch (error) {
    console.error('createOrder error:', error);
    return createResponse('error', 'Failed to create order: ' + error.message);
  }
}

/**
 * Get a single order by ID
 */
function getOrder(orderId) {
  try {
    if (!orderId) {
      return createResponse('error', 'Order ID is required');
    }
    
    const sheet = getOrCreateSheet(ORDERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return createResponse('error', 'No orders found');
    }
    
    const headers = data[0];
    const idxId = headers.indexOf('معرف الطلب');
    
    if (idxId < 0) {
      return createResponse('error', 'Order ID column not found');
    }
    
    const orderRow = data.find((row, i) => i > 0 && row[idxId] === orderId);
    
    if (!orderRow) {
      return createResponse('error', 'Order not found');
    }
    
    const orderObj = {};
    headers.forEach((header, i) => {
      orderObj[header] = orderRow[i] || '';
    });
    
    return createResponse('success', 'Order retrieved successfully', orderObj);
  } catch (error) {
    console.error('getOrder error:', error);
    return createResponse('error', 'Failed to retrieve order: ' + error.message);
  }
}

/**
 * Retrieve all orders
 */
function getOrders() {
  try {
    const orders = getSheetData(ORDERS_SHEET_NAME);
    return createResponse('success', 'Orders retrieved successfully', orders);
  } catch (error) {
    console.error('getOrders error:', error);
    return createResponse('error', 'Failed to retrieve orders: ' + error.message);
  }
}

/**
 * Update an existing order via API
 */
function updateOrder(orderId, newData, user) {
  try {
    if (!orderId) {
      return createResponse('error', 'Order ID is required');
    }
    
    const sheet = getOrCreateSheet(ORDERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return createResponse('error', 'No orders found');
    }
    
    const headers = data[0];
    const idxId = headers.indexOf('معرف الطلب');
    
    if (idxId < 0) {
      return createResponse('error', 'Order ID column not found');
    }
    
    const rowIdx = data.findIndex((row, i) => i > 0 && row[idxId] === orderId);
    
    if (rowIdx === -1) {
      return createResponse('error', 'Order not found with ID: ' + orderId);
    }
    
    // Prepare old data for logging
    const oldData = {};
    headers.forEach((header, i) => {
      oldData[header] = data[rowIdx][i] || '';
    });
    
    // Apply updates
    const updatedFields = {};
    headers.forEach((header, i) => {
      if (newData.hasOwnProperty(header) && newData[header] !== oldData[header]) {
        data[rowIdx][i] = newData[header];
        updatedFields[header] = newData[header];
      }
    });
    
    // Update the sheet
    sheet.getRange(rowIdx + 1, 1, 1, headers.length).setValues([data[rowIdx]]);
    
    // Log the update
    logUpdate(oldData, updatedFields, user, orderId);
    
    return createResponse('success', 'Order updated successfully', {
      orderId: orderId,
      updatedFields: updatedFields
    });
  } catch (error) {
    console.error('updateOrder error:', error);
    return createResponse('error', 'Failed to update order: ' + error.message);
  }
}

/**
 * Soft-delete an order via API
 */
function deleteOrder(orderId, user) {
  try {
    if (!orderId) {
      return createResponse('error', 'Order ID is required');
    }
    
    const sheet = getOrCreateSheet(ORDERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return createResponse('error', 'No orders found');
    }
    
    const headers = data[0];
    const idxId = headers.indexOf('معرف الطلب');
    
    if (idxId < 0) {
      return createResponse('error', 'Order ID column not found');
    }
    
    const rowIdx = data.findIndex((row, i) => i > 0 && row[idxId] === orderId);
    
    if (rowIdx === -1) {
      return createResponse('error', 'Order not found with ID: ' + orderId);
    }
    
    // Prepare order data for logging
    const orderData = {};
    headers.forEach((header, i) => {
      orderData[header] = data[rowIdx][i] || '';
    });
    
    // Log the deletion before removing
    logDelete(orderData, user);
    
    // Delete the row (rowIdx + 1 because sheet rows are 1-indexed)
    sheet.deleteRow(rowIdx + 1);
    
    return createResponse('success', 'Order deleted successfully', {
      orderId: orderId,
      deletedAt: new Date().toLocaleString('ar-EG')
    });
  } catch (error) {
    console.error('deleteOrder error:', error);
    return createResponse('error', 'Failed to delete order: ' + error.message);
  }
}

/**
 * Restore a previously deleted order via API
 */
function restoreOrder(timestamp, user) {
  try {
    if (!timestamp) {
      return createResponse('error', 'Timestamp is required');
    }
    
    const delSheet = getOrCreateSheet(DELETE_LOGS_SHEET_NAME);
    const data = delSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return createResponse('error', 'No delete logs found');
    }
    
    const headers = data[0];
    const idxTime = headers.indexOf('توقيت الحذف');
    const idxPayload = headers.indexOf('بيانات الطلب المحذوف');
    const idxRestored = headers.indexOf('تم الاسترجاع');
    
    if (idxTime < 0 || idxPayload < 0) {
      return createResponse('error', 'Required log headers missing');
    }
    
    const logIdx = data.findIndex((row, i) => i > 0 && row[idxTime] === timestamp);
    
    if (logIdx === -1) {
      return createResponse('error', 'Delete log not found for timestamp: ' + timestamp);
    }
    
    if (idxRestored >= 0 && data[logIdx][idxRestored] === 'نعم') {
      return createResponse('error', 'Order already restored');
    }
    
    // Parse the stored order data
    let orderData;
    try {
      orderData = JSON.parse(data[logIdx][idxPayload]);
    } catch (parseError) {
      return createResponse('error', 'Failed to parse order data from log');
    }
    
    // Restore the order
    const ordersSheet = getOrCreateSheet(ORDERS_SHEET_NAME);
    addOrderToSheet(ordersSheet, orderData);
    
    // Mark as restored
    if (idxRestored >= 0) {
      delSheet.getRange(logIdx + 1, idxRestored + 1).setValue('نعم');
    }
    
    return createResponse('success', 'Order restored successfully', {
      orderId: orderData['معرف الطلب'],
      restoredAt: new Date().toLocaleString('ar-EG')
    });
  } catch (error) {
    console.error('restoreOrder error:', error);
    return createResponse('error', 'Failed to restore order: ' + error.message);
  }
}

/**
 * Create invoice for an order
 */
function createInvoice(orderId, user) {
  try {
    if (!orderId) {
      return createResponse('error', 'Order ID is required');
    }
    
    // Get order data
    const orderResponse = getOrder(orderId);
    const orderResponseData = JSON.parse(orderResponse.getContent());
    
    if (orderResponseData.status !== 'success') {
      return createResponse('error', 'Order not found: ' + orderId);
    }
    
    const orderData = orderResponseData.data;
    
    // Create invoice data
    const invoiceData = {
      'رقم الفاتورة': 'INV-' + orderId.replace('ORD-', ''),
      'تاريخ الفاتورة': new Date().toLocaleString('ar-EG'),
      'معرف الطلب': orderId,
      'اسم العميل': orderData['الاسم الكامل'],
      'رقم الهاتف': orderData['رقم الهاتف'],
      'المنتجات': orderData['المنتج'],
      'سعر المنتجات': orderData['سعر المنتجات'],
      'تكلفة الشحن': orderData['تكلفة الشحن'],
      'المبلغ الإجمالي': orderData['التكلفة الإجمالية'],
      'العنوان': orderData['العنوان'],
      'المنطقة': orderData['المنطقة'],
      'حالة الدفع': 'في انتظار الدفع',
      'تم الإنشاء بواسطة': user || 'النظام'
    };
    
    // Create or get invoices sheet
    const invoicesSheet = getOrCreateSheet('Invoices');
    addInvoiceToSheet(invoicesSheet, invoiceData);
    
    return createResponse('success', 'Invoice created successfully', {
      invoiceNumber: invoiceData['رقم الفاتورة'],
      orderId: orderId
    });
  } catch (error) {
    console.error('createInvoice error:', error);
    return createResponse('error', 'Failed to create invoice: ' + error.message);
  }
}

/**
 * Retrieve update and delete logs
 */
function getLogs() {
  try {
    const logs = {
      updates: getSheetData(UPDATE_LOGS_SHEET_NAME),
      deletes: getSheetData(DELETE_LOGS_SHEET_NAME)
    };
    
    return createResponse('success', 'Logs retrieved successfully', logs);
  } catch (error) {
    console.error('getLogs error:', error);
    return createResponse('error', 'Failed to retrieve logs: ' + error.message);
  }
}

/**
 * Log an update operation
 */
function logUpdate(oldData, newData, user, orderId) {
  try {
    const sheet = getOrCreateSheet(UPDATE_LOGS_SHEET_NAME);
    const logData = {
      'توقيت التعديل': new Date().toLocaleString('ar-EG'),
      'تم التعديل بواسطة': user || 'غير محدد',
      'معرف الطلب': orderId || oldData['معرف الطلب'] || '',
      'بيانات الطلب (قبل)': JSON.stringify(oldData),
      'بيانات الطلب (بعد)': JSON.stringify(newData)
    };
    
    addLogToSheet(sheet, logData);
  } catch (error) {
    console.error('logUpdate error:', error);
  }
}

/**
 * Log a delete operation
 */
function logDelete(orderData, user) {
  try {
    const sheet = getOrCreateSheet(DELETE_LOGS_SHEET_NAME);
    const logData = {
      'توقيت الحذف': new Date().toLocaleString('ar-EG'),
      'تم الحذف بواسطة': user || 'غير محدد',
      'معرف الطلب': orderData['معرف الطلب'] || '',
      'بيانات الطلب المحذوف': JSON.stringify(orderData),
      'تم الاسترجاع': 'لا'
    };
    
    addLogToSheet(sheet, logData);
  } catch (error) {
    console.error('logDelete error:', error);
  }
}

/**
 * Utility: get or create a sheet by name, and set headers if new
 */
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    setupSheetHeaders(sheet, sheetName);
  }
  
  return sheet;
}

/**
 * Utility: set up headers based on sheet name
 */
function setupSheetHeaders(sheet, sheetName) {
  let headers = [];
  
  switch (sheetName) {
    case ORDERS_SHEET_NAME:
      headers = [
        'معرف الطلب', 'وقت وتاريخ الطلب', 'الاسم الكامل', 'رقم الهاتف',
        'المنتج', 'سعر المنتجات', 'تكلفة الشحن', 'التكلفة الإجمالية',
        'المنطقة', 'طريقة التوصيل', 'العنوان', 'رابط الموقع',
        'حالة الطلب', 'تم الإنشاء بواسطة'
      ];
      break;
    case UPDATE_LOGS_SHEET_NAME:
      headers = [
        'توقيت التعديل', 'تم التعديل بواسطة', 'معرف الطلب',
        'بيانات الطلب (قبل)', 'بيانات الطلب (بعد)'
      ];
      break;
    case DELETE_LOGS_SHEET_NAME:
      headers = [
        'توقيت الحذف', 'تم الحذف بواسطة', 'معرف الطلب',
        'بيانات الطلب المحذوف', 'تم الاسترجاع'
      ];
      break;
    case 'Invoices':
      headers = [
        'رقم الفاتورة', 'تاريخ الفاتورة', 'معرف الطلب', 'اسم العميل',
        'رقم الهاتف', 'المنتجات', 'سعر المنتجات', 'تكلفة الشحن',
        'المبلغ الإجمالي', 'العنوان', 'المنطقة', 'حالة الدفع', 'تم الإنشاء بواسطة'
      ];
      break;
  }
  
  if (headers.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1); // Freeze header row
  }
}

/**
 * Utility: append an order row to a given sheet
 */
function addOrderToSheet(sheet, orderData) {
  try {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = headers.map(header => orderData[header] || '');
    sheet.appendRow(row);
  } catch (error) {
    console.error('addOrderToSheet error:', error);
    throw error;
  }
}

/**
 * Utility: append an invoice row to a given sheet
 */
function addInvoiceToSheet(sheet, invoiceData) {
  try {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = headers.map(header => invoiceData[header] || '');
    sheet.appendRow(row);
  } catch (error) {
    console.error('addInvoiceToSheet error:', error);
    throw error;
  }
}

/**
 * Utility: append a log entry row to a given sheet
 */
function addLogToSheet(sheet, logData) {
  try {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = headers.map(header => logData[header] || '');
    sheet.appendRow(row);
  } catch (error) {
    console.error('addLogToSheet error:', error);
    throw error;
  }
}

/**
 * Utility: fetch all data (excluding header) from a sheet
 */
function getSheetData(sheetName) {
  try {
    const sheet = getOrCreateSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) return [];
    
    const headers = data[0];
    return data.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i] || '';
      });
      return obj;
    });
  } catch (error) {
    console.error('getSheetData error for sheet:', sheetName, error);
    return [];
  }
}

/**
 * Utility: generate a unique order ID
 */
function generateOrderId() {
  return 'ORD-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000);
}

/**
 * Utility: create standardized JSON response
 */
function createResponse(status, message, data = null) {
  const response = { 
    status: status, 
    message: message,
    timestamp: new Date().toISOString()
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test function to verify setup
 */
function testScript() {
  try {
    console.log('Testing Google Apps Script...');
    
    // Test sheet creation
    const ordersSheet = getOrCreateSheet(ORDERS_SHEET_NAME);
    const updateLogsSheet = getOrCreateSheet(UPDATE_LOGS_SHEET_NAME);
    const deleteLogsSheet = getOrCreateSheet(DELETE_LOGS_SHEET_NAME);
    const invoicesSheet = getOrCreateSheet('Invoices');
    
    console.log('All sheets created successfully');
    
    // Test order creation
    const testOrderData = {
      'الاسم الكامل': 'اختبار',
      'رقم الهاتف': '01234567890',
      'المنتج': 'منتج تجريبي',
      'سعر المنتجات': 100,
      'تكلفة الشحن': 20,
      'التكلفة الإجمالية': 120,
      'المنطقة': 'القاهرة',
      'العنوان': 'عنوان تجريبي'
    };
    
    const createResult = createOrder(testOrderData, 'اختبار النظام');
    console.log('Test order creation result:', createResult.getContent());
    
    return 'Script test completed successfully';
  } catch (error) {
    console.error('Test script error:', error);
    return 'Script test failed: ' + error.message;
  }
}