import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { LayoutDashboard, Receipt, Settings } from 'lucide-react';

const API_URL = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    fetchSummary();
    fetchTransactions();
  }, []);

  const fetchSummary = async () => {
    try {
      const response = await axios.get(`${API_URL}/dashboard/summary/`);
      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await axios.get(`${API_URL}/transactions/`);
      setTransactions(response.data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API_URL}/upload-csv/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchSummary();
      fetchTransactions();
      alert('Upload successful');
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Upload failed');
    }
  };

  const chartData = summary?.monthly_data.reduce((acc, curr) => {
    const monthName = new Date(curr.year, curr.month - 1).toLocaleString('default', { month: 'short' });
    const existing = acc.find(item => item.name === `${monthName} ${curr.year}`);
    
    if (existing) {
      if (curr.type === 'ДОХОД') existing.Income = curr.total;
      if (curr.type === 'РАСХОД') existing.Expense = curr.total;
    } else {
      acc.push({
        name: `${monthName} ${curr.year}`,
        Income: curr.type === 'ДОХОД' ? curr.total : 0,
        Expense: curr.type === 'РАСХОД' ? curr.total : 0
      });
    }
    return acc;
  }, []) || [];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-800">Cashflow P&L</h1>
        </div>
        <nav className="mt-6">
          <a
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center px-6 py-3 cursor-pointer ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <LayoutDashboard className="w-5 h-5 mr-3" />
            Баланс / Dashboard
          </a>
          <a
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center px-6 py-3 cursor-pointer ${activeTab === 'transactions' ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Receipt className="w-5 h-5 mr-3" />
            ДДС (Transactions)
          </a>
          <a
            onClick={() => setActiveTab('income')}
            className={`flex items-center px-6 py-3 cursor-pointer ${activeTab === 'income' ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Receipt className="w-5 h-5 mr-3" />
            Доходы (Income)
          </a>
          <a
            onClick={() => setActiveTab('expenses')}
            className={`flex items-center px-6 py-3 cursor-pointer ${activeTab === 'expenses' ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Receipt className="w-5 h-5 mr-3" />
            Расходы (Expenses)
          </a>
          <a
            onClick={() => setActiveTab('settings')}
            className={`flex items-center px-6 py-3 cursor-pointer ${activeTab === 'settings' ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Settings className="w-5 h-5 mr-3" />
            Settings / Upload
          </a>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {activeTab === 'dashboard' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Баланс (Dashboard)</h2>
              
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-gray-500 text-sm font-medium">Total Income</h3>
                  <p className="text-3xl font-bold text-green-600 mt-2">
                    {summary?.total_income.toLocaleString()} UZS
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-gray-500 text-sm font-medium">Total Expenses</h3>
                  <p className="text-3xl font-bold text-red-600 mt-2">
                    {summary?.total_expense.toLocaleString()} UZS
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-gray-500 text-sm font-medium">Net Balance</h3>
                  <p className={`text-3xl font-bold mt-2 ${summary?.net_balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {summary?.net_balance.toLocaleString()} UZS
                  </p>
                </div>
              </div>

              {/* Chart */}
              <div className="bg-white rounded-lg shadow p-6 mb-8">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Income vs Expenses (Monthly)</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Income" fill="#10B981" name="Income (UZS)" />
                      <Bar dataKey="Expense" fill="#EF4444" name="Expense (UZS)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">ДДС (Все транзакции)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-200">
                      <th className="p-4 font-medium">Date</th>
                      <th className="p-4 font-medium">Type</th>
                      <th className="p-4 font-medium">Category</th>
                      <th className="p-4 font-medium">Project / Student</th>
                      <th className="p-4 font-medium">Amount (UZS)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-4">{t.date}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${t.type === 'ДОХОД' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-gray-700">{t.category}</td>
                        <td className="p-4 text-sm text-gray-700">{t.project}</td>
                        <td className={`p-4 font-medium ${t.type === 'ДОХОД' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.type === 'ДОХОД' ? '+' : '-'}{t.amount_uzs.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'income' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">Доходы</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-200">
                      <th className="p-4 font-medium">Date</th>
                      <th className="p-4 font-medium">Category</th>
                      <th className="p-4 font-medium">Student / Payer</th>
                      <th className="p-4 font-medium">Amount (UZS)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.filter(t => t.type === 'ДОХОД').map((t, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-4">{t.date}</td>
                        <td className="p-4 text-sm text-gray-700">{t.category}</td>
                        <td className="p-4 text-sm text-gray-700">{t.project}</td>
                        <td className="p-4 font-medium text-green-600">
                          +{t.amount_uzs.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">Расходы</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-200">
                      <th className="p-4 font-medium">Date</th>
                      <th className="p-4 font-medium">Category</th>
                      <th className="p-4 font-medium">Project / Recipient</th>
                      <th className="p-4 font-medium">Amount (UZS)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.filter(t => t.type === 'РАСХОД').map((t, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-4">{t.date}</td>
                        <td className="p-4 text-sm text-gray-700">{t.category}</td>
                        <td className="p-4 text-sm text-gray-700">{t.project}</td>
                        <td className="p-4 font-medium text-red-600">
                          -{t.amount_uzs.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Settings & Data Import</h2>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Excel/CSV Data
                </label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Upload the massive CSV or Excel file exported from Pifagor system to populate the database.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
