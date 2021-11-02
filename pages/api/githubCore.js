import axios from 'axios';
import moment from 'moment';

export default async function handler(req, res) {
	const $http = axios.create({
		headers: {
			'Authorization': `token ${process.env.GITHUB_TOKEN}`,
			'Content-Type': 'application/json',
		},
	});

	const { organisation, date } = req.query;

	if (!organisation) {
		res.status(400).json({ error: 'Missing organisation' });
		return;
	}

	let REFERENCE_DATE = moment().subtract(1, 'day');

	if (date) {
		REFERENCE_DATE = moment(date);
	}

	const url = `https://api.github.com/orgs/${organisation}/repos`;

	try {
		const { data } = await $http.get(url, {});

		const repos = await Promise.all(
			data.map(async (repo) => {
				const {
					full_name: repo_full_name,
					description: repo_description,
					html_url: repo_html_url,
				} = repo;

				const pr_url = `https://api.github.com/repos/${repo_full_name}/pulls?state=closed`;
				const { data: pr_data } = await $http.get(pr_url);

				const closed_prs = pr_data.filter((pr) => {
					const { merged_at: pr_merged_at } = pr;
					return moment(pr_merged_at).isSame(REFERENCE_DATE, 'day');
				});

				return {
					name: repo_full_name,
					description: repo_description,
					url: repo_html_url,
					number_of_closed_prs: closed_prs.length,
					closed_prs: closed_prs.map((pr) => ({
						title: pr.title,
						url: pr.html_url,
					})),
				};
			})
		);

		res.status(200).json({
			total_number_of_closed_prs: repos.reduce(
				(acc, repo) => acc + repo.number_of_closed_prs,
				0
			),
            data: repos,
		});
	} catch (error) {
		res.status(500).json({ error: error });
	}
}
