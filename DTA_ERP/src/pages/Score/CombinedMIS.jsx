import React, { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import MainLayout from "../../components/layout/MainLayout";
import Loader from "../../components/common/Loader";
import { API_BASE_URL } from "../../config";

const CombinedMIS = () => {
  const { user, token } = useSelector((state) => state.auth);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);

  // Dummy data generation based on existing users
  const [reportData, setReportData] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/master/employees`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsers(res.data);

        const isAdmin = user?.role === "Admin" || user?.role === "SuperAdmin";

        // Mocking some data for the report (Randomized for demo for Admins only)
        const mockData = res.data.map((u) => {
          const name = `${u.First_Name} ${u.Last_Name}`;
          // Regular employees see 0, Admins see dummy data
          const planned = isAdmin ? Math.floor(Math.random() * 40) + 10 : 0;
          const completed = isAdmin ? Math.floor(planned * 0.6) : 0;
          const pending = isAdmin ? Math.floor(planned * 0.25) : 0;
          const delay = isAdmin ? planned - completed - pending : 0;

          return {
            id: u.id,
            name: name,
            planned,
            completed,
            pending,
            delay,
          };
        });

        // If current user is not Admin/SuperAdmin and their id is not in the list, add an entry with zeros
        if (
          user?.role !== "Admin" &&
          user?.role !== "SuperAdmin" &&
          !mockData.some((d) => String(d.id) === String(user?.id))
        ) {
          mockData.push({
            id: user?.id,
            name: user?.name || "You",
            planned: 0,
            completed: 0,
            pending: 0,
            delay: 0,
          });
        }

        setReportData(mockData);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching users:", error);
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [token, user]);

  const filteredData = useMemo(() => {
    let data = reportData;

    // Visibility logic: Admin sees all, User sees only self
    if (user?.role !== "Admin" && user?.role !== "SuperAdmin") {
      data = data.filter((d) => String(d.id) === String(user?.id));
    } else if (selectedUser !== "ALL") {
      data = data.filter((d) => String(d.id) === String(selectedUser));
    }

    return data;
  }, [reportData, selectedUser, user]);

  return (
    <MainLayout title="Combined MIS Score">
      <div className="flex flex-col gap-4 p-4">
        {/* Filters */}
        {(user?.role === "Admin" || user?.role === "SuperAdmin") && (
          <div className="flex justify-end bg-bg-card border border-border-main rounded-xl p-4 shadow-sm">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold uppercase text-text-muted">
                Filter by Name
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="mt-1 bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm w-[250px]"
              >
                <option value="ALL">All Users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.First_Name} {u.Last_Name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader />
          </div>
        ) : (
          <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-main/40 text-text-muted uppercase text-[10px]">
                  <th className="px-4 py-4 text-left">Name</th>
                  <th className="px-4 py-4 text-center">Planned</th>
                  <th className="px-4 py-4 text-center">Completed</th>
                  <th className="px-4 py-4 text-center">Pending</th>
                  <th className="px-4 py-4 text-center">Delay</th>
                  <th className="px-4 py-4 text-center text-primary">Done %</th>
                  <th className="px-4 py-4 text-center text-red-500">
                    Not Done %
                  </th>
                  <th className="px-4 py-4 text-center text-orange-500">
                    Pending %
                  </th>
                  <th className="px-4 py-4 text-center text-red-500">
                    Not Done in Time %
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row) => {
                  const planned = row.planned || 1; // Fallback to 1 to avoid NaN if planned is 0
                  const isPlannedZero = row.planned === 0;

                  const donePercent = isPlannedZero
                    ? "0.0"
                    : ((row.completed / planned) * 100).toFixed(1);
                  const pendingPercent = isPlannedZero
                    ? "0.0"
                    : ((row.pending / planned) * 100).toFixed(1);
                  const duePercent = isPlannedZero
                    ? "0.0"
                    : ((row.delay / planned) * 100).toFixed(1);
                  const notDonePercent = isPlannedZero
                    ? "0.0"
                    : (((row.pending + row.delay) / planned) * 100).toFixed(1);

                  return (
                    <tr
                      key={row.id}
                      className="border-t border-border-main hover:bg-bg-main/20"
                    >
                      <td className="px-4 py-4 font-semibold">{row.name}</td>
                      <td className="px-4 py-4 text-center">{row.planned}</td>
                      <td className="px-4 py-4 text-center">{row.completed}</td>
                      <td className="px-4 py-4 text-center">{row.pending}</td>
                      <td className="px-4 py-4 text-center">{row.delay}</td>
                      <td className="px-4 py-4 text-center font-bold text-primary">
                        {donePercent}%
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-red-500">
                        - {notDonePercent}%
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-orange-500">
                        {pendingPercent}%
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-red-500">
                        - {duePercent}%
                      </td>
                    </tr>
                  );
                })}
                {filteredData.length === 0 && (
                  <tr>
                    <td
                      colSpan="9"
                      className="p-8 text-center text-text-muted font-bold"
                    >
                      No data found for the selected filter
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default CombinedMIS;
