import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';

interface BlogPost {
  id: number;
  title: string;
  date: string;
  image: string;
  excerpt: string;
}

@Component({
  selector: 'app-blogs-grid',
  templateUrl: './blogs-grid.component.html',
  styleUrls: ['./blogs-grid.component.scss']
})
export class BlogsGridComponent implements OnInit {

  blogPosts: BlogPost[] = [
    {
      id: 1,
      title: 'We have announced our new product.',
      date: '22 Aug, 2020',
      image: 'assets/img/blog1.jpg',
      excerpt: 'Lorem ipsum dolor a sit ameti, consectetur adipisicing elit, sed do eiusmod tempor incididunt sed do incididunt sed.'
    },
    {
      id: 2,
      title: 'Top five way for solving teeth problems.',
      date: '15 Jul, 2020',
      image: 'assets/img/blog2.jpg',
      excerpt: 'Lorem ipsum dolor a sit ameti, consectetur adipisicing elit, sed do eiusmod tempor incididunt sed do incididunt sed.'
    },
    {
      id: 3,
      title: 'We provide highly business solutions.',
      date: '05 Jan, 2020',
      image: 'assets/img/blog3.jpg',
      excerpt: 'Lorem ipsum dolor a sit ameti, consectetur adipisicing elit, sed do eiusmod tempor incididunt sed do incididunt sed.'
    },
    {
      id: 4,
      title: 'We provide highly business solutions.',
      date: '05 Jan, 2020',
      image: 'assets/img/blog3.jpg',
      excerpt: 'Lorem ipsum dolor a sit ameti, consectetur adipisicing elit, sed do eiusmod tempor incididunt sed do incididunt sed.'
    },
    {
      id: 5,
      title: 'We have announced our new product.',
      date: '22 Aug, 2020',
      image: 'assets/img/blog1.jpg',
      excerpt: 'Lorem ipsum dolor a sit ameti, consectetur adipisicing elit, sed do eiusmod tempor incididunt sed do incididunt sed.'
    },
    {
      id: 6,
      title: 'Top five way for solving teeth problems.',
      date: '15 Jul, 2020',
      image: 'assets/img/blog2.jpg',
      excerpt: 'Lorem ipsum dolor a sit ameti, consectetur adipisicing elit, sed do eiusmod tempor incididunt sed do incididunt sed.'
    }
  ];

  recentPosts: BlogPost[] = [
    {
      id: 7,
      title: 'We have announced our new product.',
      date: 'Jan 11, 2020',
      image: 'assets/img/blog-sidebar1.jpg',
      excerpt: ''
    },
    {
      id: 8,
      title: 'Top five way for solving teeth problems.',
      date: 'Mar 05, 2019',
      image: 'assets/img/blog-sidebar2.jpg',
      excerpt: ''
    },
    {
      id: 9,
      title: 'We provide highly business solutions.',
      date: 'June 09, 2019',
      image: 'assets/img/blog-sidebar3.jpg',
      excerpt: ''
    }
  ];

  categories = [
    'Men\'s Apparel',
    'Women\'s Apparel',
    'Bags Collection',
    'Accessories',
    'Sun Glasses'
  ];

  tags = [
    'business',
    'wordpress',
    'html',
    'multipurpose',
    'education',
    'template',
    'Ecommerce'
  ];

  constructor(
    private titleService: Title,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Блог');
  }

  onBlogClick(blogId: number): void {
    this.router.navigate(['/home/blog-single', blogId]);
  }

  onSearch(event: any): void {
    const searchTerm = event.target.value;
    // Implement search logic here
    console.log('Search term:', searchTerm);
  }
}